#!/usr/bin/env python3
"""Portable ViperLink controller: Python 3.10+, TLS 1.3, no third-party packages.

Runs on macOS, Windows and Linux. A provisioned JSON file is a credential:
keep it private. Commands execute on the selected host/agent, not this client.
"""
import argparse
import base64
import hashlib
import hmac
import json
import os
import pathlib
import socket
import ssl
import struct
import sys
import uuid

MAX_FRAME, CHUNK, MAX_FILE = 65536, 32768, 8 * 1024**3


def un64(value):
    return base64.b64decode(value, validate=True)


def b64(value):
    return base64.b64encode(value).decode("ascii")


def auth(secret, domain, server_id, nonce, client_nonce):
    message = ("ROBViperLink/1 " + domain + "\0" + server_id.lower() + "\0").encode() + nonce + client_nonce
    return hmac.digest(secret, message, "sha256")


class Client:
    def __init__(self, profile, host=None):
        if not ssl.HAS_TLSv1_3 or not hasattr(ssl,"VERIFY_X509_PARTIAL_CHAIN"):
            raise RuntimeError("Use Python 3.10+ with TLS 1.3 support (for example Homebrew Python on macOS).")
        self.profile = profile
        cert, self.secret = un64(profile["certificate"]), un64(profile["secret"])
        if profile["version"] != 1 or len(self.secret) != 32:
            raise ValueError("Invalid provisioning profile")
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        context.minimum_version = ssl.TLSVersion.TLSv1_3
        # The exact pinned leaf is the trust anchor. DNS names are discovery only.
        context.check_hostname = False
        context.verify_mode = ssl.CERT_REQUIRED
        context.load_verify_locations(cadata=ssl.DER_cert_to_PEM_cert(cert))
        context.verify_flags |= ssl.VERIFY_X509_PARTIAL_CHAIN
        context.set_alpn_protocols(["rob-viperlink/1"])
        raw = socket.create_connection((host or profile["host"], profile["port"]), timeout=15)
        try:
            self.sock = context.wrap_socket(raw, server_hostname=host or profile["host"])
            if self.sock.selected_alpn_protocol() != "rob-viperlink/1" or not hmac.compare_digest(hashlib.sha256(self.sock.getpeercert(binary_form=True)).digest(), hashlib.sha256(cert).digest()):
                raise ValueError("Host certificate or protocol did not match")
            challenge = self.receive()
            nonce = un64(challenge["nonce"])
            if challenge["op"] != "challenge" or challenge["serverID"] != profile["serverID"] or len(nonce) != 32:
                raise ValueError("Invalid host challenge")
            cn = os.urandom(32)
            self.send(dict(op="authenticate", clientID=profile["clientID"], nonce=b64(cn), mac=b64(auth(self.secret,"client",profile["serverID"],nonce,cn))))
            response = self.receive()
            if response.get("op") != "ready" or not hmac.compare_digest(un64(response["mac"]),auth(self.secret,"server",profile["serverID"],nonce,cn)):
                raise ValueError("Host authentication failed")
            if response.get("role") != "controller":
                raise ValueError("This utility needs a controller profile")
        except BaseException:
            raw.close()
            if hasattr(self,"sock"):
                self.sock.close()
            raise

    def close(self):
        self.sock.close()

    def exact(self, size):
        data = bytearray()
        while len(data) < size:
            part = self.sock.recv(size-len(data))
            if not part:
                raise ConnectionError("Connection closed; no operation was replayed")
            data.extend(part)
        return bytes(data)

    def receive(self):
        kind, size = struct.unpack("!II", self.exact(8))
        if kind != 1 or not 0 < size <= MAX_FRAME:
            raise ValueError("Invalid AutoNet frame")
        packet = json.loads(self.exact(size))
        if not isinstance(packet,dict):
            raise ValueError("Expected a JSON object")
        return packet

    def send(self, packet):
        data = json.dumps(packet,separators=(",",":"),allow_nan=False).encode()
        if not 0 < len(data) <= MAX_FRAME:
            raise ValueError("Frame too large")
        self.sock.sendall(struct.pack("!II",1,len(data))+data)

    def request(self, op, target="host", output=None, **values):
        request_id = str(uuid.uuid4())
        self.sock.settimeout(values.get("timeout",20)+15)
        self.send(dict(op=op,id=request_id,target=target,**values))
        total = 0
        while True:
            packet = self.receive()
            if packet.get("id") != request_id:
                raise ValueError("Unexpected response identifier")
            if packet.get("op") == "output":
                data = un64(packet["data"]); total += len(data)
                if len(data) > CHUNK or total > 2*1024**2:
                    raise ValueError("Output limit exceeded")
                if output:
                    output(data)
            elif packet.get("op") == "done":
                if "error" in packet:
                    raise RuntimeError(packet["error"])
                return packet
            else:
                raise ValueError("Invalid response operation")

    def upload(self, source, target="host", name=None):
        source = pathlib.Path(source)
        with source.open("rb") as file:
            size = os.fstat(file.fileno()).st_size
            if size > MAX_FILE:
                raise ValueError("File exceeds 8 GiB")
            self.request("put.begin",target,name=name or source.name,size=size)
            offset, digest = 0, hashlib.sha256()
            try:
                while data := file.read(CHUNK):
                    reply = self.request("put.chunk",target,offset=offset,data=b64(data))
                    digest.update(data); offset += len(data)
                    if reply["offset"] != offset:
                        raise ValueError("Upload offset mismatch")
                if offset != size:
                    raise ValueError("Source file size changed")
                result = self.request("put.finish",target,sha256=digest.hexdigest())
                if result["sha256"] != digest.hexdigest():
                    raise ValueError("Upload checksum mismatch")
                return digest.hexdigest()
            except BaseException:
                self.close()
                raise

    def download(self, name, destination, target="host"):
        destination = pathlib.Path(destination)
        temporary = destination.with_name(".viperlink-"+str(uuid.uuid4()))
        offset, digest = 0, hashlib.sha256()
        try:
            size = self.request("get.begin",target,name=name)["size"]
            if not isinstance(size,int) or not 0 <= size <= MAX_FILE:
                raise ValueError("Invalid file size")
            fd = os.open(temporary,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
            with os.fdopen(fd,"wb") as file:
                while True:
                    p = self.request("get.next",target,offset=offset)
                    data = un64(p["data"]); offset += len(data)
                    if len(data) > CHUNK or offset > size or p["offset"] != offset:
                        raise ValueError("Download offset mismatch")
                    file.write(data); digest.update(data)
                    if p.get("eof") is True:
                        if offset != size or p["sha256"] != digest.hexdigest():
                            raise ValueError("Download checksum mismatch")
                        file.flush(); os.fsync(file.fileno()); break
                    if not data:
                        raise ValueError("Empty non-final chunk")
            # A hard link atomically refuses to overwrite an existing destination.
            os.link(temporary,destination)
            return digest.hexdigest()
        finally:
            temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile",required=True,type=pathlib.Path)
    parser.add_argument("--host",help="LAN or VPN hostname override; certificate remains pinned")
    parser.add_argument("--target",default="host")
    sub = parser.add_subparsers(dest="action",required=True)
    sub.add_parser("clients"); sub.add_parser("files")
    execute = sub.add_parser("exec"); execute.add_argument("command"); execute.add_argument("--timeout",type=int,default=60)
    send = sub.add_parser("put"); send.add_argument("file"); send.add_argument("--name")
    receive = sub.add_parser("get"); receive.add_argument("name"); receive.add_argument("output")
    args = parser.parse_args()
    if args.profile.stat().st_size > 16384:
        parser.error("Profile is too large")
    if os.name == "posix" and args.profile.stat().st_mode & 0o077:
        parser.error("Profile must be private: chmod 600 <profile>")
    client = Client(json.loads(args.profile.read_text()),args.host)
    try:
        if args.action == "exec":
            if not 1 <= args.timeout <= 300:
                parser.error("Timeout must be 1–300 seconds")
            result = client.request("exec",args.target,command=args.command,timeout=args.timeout,output=sys.stdout.buffer.write)
            return result["exit"]
        if args.action == "put":
            print(client.upload(args.file,args.target,args.name))
        elif args.action == "get":
            print(client.download(args.name,args.output,args.target))
        else:
            print(json.dumps(client.request(args.action,args.target),indent=2))
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, RuntimeError, KeyError) as error:
        print(str(error),file=sys.stderr)
        sys.exit(1)
