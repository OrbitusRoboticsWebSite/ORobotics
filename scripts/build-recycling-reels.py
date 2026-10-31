#!/usr/bin/env python3
"""Build the published reels from private, color-correct H.264 shot exports.

Requires FFmpeg, ffprobe and Pillow. See social/reels/recycling/README.md.
All subprocess arguments are passed directly; no shell interpolation is used.
"""
import argparse
import json
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONT_DIR = Path('/System/Library/Fonts/Supplemental')


def run(args):
    subprocess.run([str(a) for a in args], check=True)


def font(size, bold=False):
    return ImageFont.truetype(str(FONT_DIR / ('Arial Bold.ttf' if bold else 'Arial.ttf')), size)


def overlay(path, shape, title, number, outro=False, wide=False):
    w, h = shape
    im = Image.new('RGBA', shape)
    d = ImageDraw.Draw(im)
    if outro:
        d.rectangle((0, 0, w, h), fill=(9, 16, 29, 242))
        y = h * .36
        for text, size, color in [('ORBITUS ROBOTICS', 32, '#c5b5fd'),
                                   ('More ROB. Less waiting.', 66 if w > h else 58, 'white'),
                                   ('orbitusrobotics.com/recycling', 31, '#cbd5e1')]:
            d.text((w/2, y), text, font=font(size, True), fill=color, anchor='mt')
            y += 100
    elif w > h:
        d.rounded_rectangle((36, 34, 485, 118), 15, fill=(9, 16, 29, 205))
        d.text((58, 58), 'ORBITUS ROBOTICS', font=font(32, True), fill='white')
        x, y = (58, 770) if wide else (58, 405)
        d.rounded_rectangle((x-22, y-28, x+495, y+173), 18, fill=(9, 16, 29, 210))
        d.text((x, y), 'CAN-HANDLING SESSIONS', font=font(23, True), fill='#c5b5fd')
        d.text((x, y+48), title, font=font(61, True), fill='white')
        d.text((x, y+130), 'Edited highlights · Real-time motion', font=font(23), fill='#cbd5e1')
        d.rounded_rectangle((1310, 952, 1872, 1030), 14, fill=(9, 16, 29, 205))
        d.text((1335, 975), 'orbitusrobotics.com', font=font(32, True), fill='white')
    else:
        # Keep graphics above the gripper, can trajectory, and bucket.
        d.rounded_rectangle((50, 160, w-50, 365), 24, fill=(9, 16, 29, 213))
        d.text((80, 187), 'ORBITUS ROBOTICS', font=font(30, True), fill='#c5b5fd')
        d.text((80, 244), title, font=font(67, True), fill='white')
        d.text((80, 324), 'Edited highlights · Real-time motion', font=font(27), fill='#cbd5e1')
    im.save(path)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--shots', type=Path, required=True)
    p.add_argument('--work', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--format', choices=['demo', 'reel'], required=True)
    a = p.parse_args()
    a.work.mkdir(parents=True, exist_ok=True)
    a.output.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((ROOT/'social/reels/recycling/edit.json').read_text())
    edit = manifest['formats'][a.format]
    width, height = edit['size']
    parts = []
    for index, shot_id in enumerate(edit['shots']):
        shot = manifest['shots'][shot_id]
        source = a.shots / (shot_id+'.mp4')
        if not source.is_file():
            raise FileNotFoundError(source)
        target = a.work / f'{a.format}-{index:02d}.mp4'
        png = target.with_suffix('.png')
        info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
                           '-show_entries', 'stream=width,height', '-of', 'json', str(source)]))['streams'][0]
        wide = info['width'] > info['height']
        overlay(png, (width, height), shot['title'], f'{index+1:02d}', wide=wide)
        if width > height and not wide:
            video = (f'[0:v:0]split[bg][fg];[bg]scale=480:270:force_original_aspect_ratio=increase,'
                     f'crop=480:270,boxblur=16:1,eq=brightness=-0.22:saturation=0.45,'
                     f'scale={width}:{height}[back];[fg]scale=-2:{height}[front];'
                     '[back][front]overlay=(W-w)/2:0[framed];')
        else:
            video = (f'[0:v:0]scale={width}:{height}:force_original_aspect_ratio=decrease,'
                     f'pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=0x0b111c[framed];')
        filters = video + '[framed][1:v:0]overlay=0:0,setsar=1,fps=30,format=yuv420p[v]'
        audio = f'highpass=f=60,alimiter=limit=0.9:level=false,afade=t=in:d=0.02,afade=t=out:st={shot["duration"]-.04}:d=0.04'
        run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-threads', '2', '-i', source,
             '-loop', '1', '-i', png, '-filter_complex_threads', '2', '-filter_complex', filters,
             '-map', '[v]', '-map', '0:a:0', '-af', audio, '-t', shot['duration'],
             '-c:v', 'libx264', '-preset', 'fast', '-crf', '24', '-threads', '2',
             '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2',
             '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
             '-map_metadata', '-1', '-map_chapters', '-1', '-movflags', '+faststart', target])
        parts.append(target)
    png = a.work / f'{a.format}-outro.png'
    outro = a.work / f'{a.format}-outro.mp4'
    overlay(png, (width, height), '', '', outro=True)
    run(['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', '30', '-i', png,
         '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', edit['outro'],
         '-c:v', 'libx264', '-preset', 'fast', '-crf', '24', '-threads', '2',
         '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k',
         '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
         '-map_metadata', '-1', '-map_chapters', '-1', outro])
    parts.append(outro)
    listing = a.work / f'{a.format}-concat.txt'
    # FFmpeg concat-file quoting, including filenames containing apostrophes.
    listing.write_text(''.join("file '"+str(part.resolve()).replace("'", "'\\''")+"'\n" for part in parts))
    output = a.output / f'rob-recycling-{a.format}.mp4'
    run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listing,
         '-map', '0:v:0', '-map', '0:a:0', '-c', 'copy', '-map_metadata', '-1', '-map_chapters', '-1',
         '-movflags', '+faststart', output])
    print(output)


if __name__ == '__main__':
    main()
