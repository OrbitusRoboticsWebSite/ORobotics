#!/usr/bin/env python3
"""Build the published reels from private, color-correct H.264 shot exports.

Requires FFmpeg, ffprobe and Pillow. See social/reels/recycling/README.md.
All subprocess arguments are passed directly; no shell interpolation is used.
"""
import argparse
import json
from pathlib import Path
import re
import subprocess

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONT_DIR = Path('/System/Library/Fonts/Supplemental')


def run(args):
    subprocess.run([str(a) for a in args], check=True)


def font(size, bold=False):
    return ImageFont.truetype(str(FONT_DIR / ('Arial Bold.ttf' if bold else 'Arial.ttf')), size)


def normalize_audio(source, output, target_lufs, report):
    """Balance quiet workshop sounds and the can impact without altering video."""
    base = f'loudnorm=I={target_lufs}:TP=-1.5:LRA=11'
    measured = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(source),
                               '-af', base+':print_format=json', '-vn', '-f', 'null', '-'],
                              check=True, capture_output=True, text=True)
    match = re.search(r'\{\s*"input_i"[\s\S]*?\}', measured.stderr)
    if match is None:
        raise RuntimeError('FFmpeg did not return a loudness measurement')
    levels = json.loads(match.group())
    report.write_text(json.dumps(levels, indent=2)+'\n')
    audio = (base+f':measured_I={levels["input_i"]}:measured_TP={levels["input_tp"]}'
             f':measured_LRA={levels["input_lra"]}:measured_thresh={levels["input_thresh"]}'
             f':offset={levels["target_offset"]}:linear=false')
    run(['ffmpeg', '-v', 'error', '-y', '-i', source, '-map', '0:v:0', '-map', '0:a:0',
         '-c:v', 'copy', '-af', audio, '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2',
         '-map_metadata', '-1', '-map_chapters', '-1', '-movflags', '+faststart', output])


def overlay(path, shape, title, number, outro=False, wide=False, layout=None, episode=None,
            footer='Edited workshop tests · Normal speed',
            outro_title='More ROB. Less waiting.', outro_url='orbitusrobotics.com/recycling'):
    w, h = shape
    im = Image.new('RGBA', shape)
    d = ImageDraw.Draw(im)
    if outro:
        d.rectangle((0, 0, w, h), fill=(9, 16, 29, 242))
        y = h * .36
        for text, size, color in [('ORBITUS ROBOTICS', 32, '#c5b5fd'),
                                   (outro_title, 66 if w > h else 58, 'white'),
                                   (outro_url, 31, '#cbd5e1')]:
            d.text((w/2, y), text, font=font(size, True), fill=color, anchor='mt')
            y += 100
    elif layout == 'process':
        # Dedicated title/footer space keeps the gripper and torso unobscured.
        if wide:
            d.rectangle((0, 0, w, 180), fill='#0b111c')
            d.rectangle((0, 1780, w, h), fill='#0b111c')
        d.text((90, 33), episode, font=font(27, True), fill='#c5b5fd')
        d.text((90, 88), title, font=font(54, True), fill='white')
        d.line((90, 163, w-90, 163), fill='#334155', width=2)
        d.text((w/2, 1810), footer, font=font(26), fill='#cbd5e1', anchor='mt')
        d.text((w/2, 1860), 'ORBITUS ROBOTICS', font=font(26, True), fill='#c5b5fd', anchor='mt')
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
    p.add_argument('--format', required=True)
    p.add_argument('--edit', type=Path, default=ROOT/'social/reels/recycling/edit.json',
                   help='Edit manifest; defaults to the original recycling highlights.')
    a = p.parse_args()
    a.work.mkdir(parents=True, exist_ok=True)
    a.output.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(a.edit.read_text())
    if a.format not in manifest['formats']:
        p.error(f'Unknown format {a.format!r}; choose from {", ".join(manifest["formats"])}')
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
        overlay(png, (width, height), shot['title'], f'{index+1:02d}', wide=wide,
                layout=edit.get('layout'), episode=edit.get('episode'),
                footer=edit.get('footer', 'Edited workshop tests · Normal speed'))
        if edit.get('layout') == 'process' and 'crop' in shot:
            # A reviewed normalized crop can make landscape action legible on
            # phones. Keep the complete action and any human assistance visible.
            x, y, w, h = shot['crop']
            if not (0 <= x < 1 and 0 <= y < 1 and 0 < w <= 1 and 0 < h <= 1
                    and x+w <= 1 and y+h <= 1):
                raise ValueError(f'Invalid normalized crop for {shot_id}')
            video = (f'[0:v:0]crop=iw*{w}:ih*{h}:iw*{x}:ih*{y},'
                     'scale=1080:1600:force_original_aspect_ratio=decrease,'
                     'pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x0b111c[framed];')
        elif edit.get('layout') == 'process' and wide:
            # Preserve the can, glass and both arms in landscape source shots.
            video = ('[0:v:0]split[bg][fg];[bg]scale=270:480:force_original_aspect_ratio=increase,'
                     'crop=270:480,boxblur=12:1,eq=brightness=-0.35:saturation=0.5,'
                     'scale=1080:1920[back];[fg]scale=1080:-2[front];'
                     '[back][front]overlay=(W-w)/2:(H-h)/2[framed];')
        elif edit.get('layout') == 'process':
            video = ('[0:v:0]scale=900:1600:force_original_aspect_ratio=decrease,'
                     'pad=1080:1920:(ow-iw)/2:180:color=0x0b111c[framed];')
        elif width > height and not wide:
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
    overlay(png, (width, height), '', '', outro=True,
            outro_title=edit.get('outroTitle', 'More ROB. Less waiting.'),
            outro_url=edit.get('outroUrl', 'orbitusrobotics.com/recycling'))
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
    output = a.output / edit.get('filename', f'rob-recycling-{a.format}.mp4')
    joined = a.work / f'{a.format}-joined.mp4' if 'audioLufs' in edit else output
    run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listing,
         '-map', '0:v:0', '-map', '0:a:0', '-c', 'copy', '-map_metadata', '-1', '-map_chapters', '-1',
          '-movflags', '+faststart', joined])
    if 'audioLufs' in edit:
        normalize_audio(joined, output, edit['audioLufs'], a.work/f'{a.format}-loudness.json')
    print(output)


if __name__ == '__main__':
    main()
