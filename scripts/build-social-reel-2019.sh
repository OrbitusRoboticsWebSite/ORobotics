#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_dir="$repo_root/static/images/galleries/2019/video"
output_dir="$repo_root/social/reels/2019-rob-learned-to-move"
output_file="$output_dir/rob-2019-recap.mp4"
cover_file="$output_dir/rob-2019-recap-cover.jpg"
logo_file="$repo_root/static/images/orbitusrobotics white logo no text no background.png"
font_file="/System/Library/Fonts/Supplemental/Arial.ttf"
work_dir="$(mktemp -d /tmp/orbitus-2019-reel.XXXXXX)"

cleanup() {
  rm -rf "$work_dir"
}
trap cleanup EXIT

for command_name in ffmpeg ffprobe magick; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
done

if [[ ! -f "$font_file" || ! -f "$logo_file" ]]; then
  echo "Missing reel font or Orbitus logo asset" >&2
  exit 1
fi

mkdir -p "$output_dir"

magick -size 720x1280 'gradient:#06101f-#0b3858' \
  \( "$logo_file" -resize 250x250 \) -gravity north -geometry +0+90 -composite \
  -font "$font_file" -gravity center -fill white -pointsize 92 \
  -annotate +0-80 '2019' \
  -pointsize 48 -annotate +0+35 'ROB learned to move' \
  -fill '#73d8ff' -pointsize 28 \
  -annotate +0+125 'A workshop memory from Orbitus Robotics' \
  "$work_dir/title.png"

magick -size 720x1280 'gradient:#0b3858-#06101f' \
  \( "$logo_file" -resize 220x220 \) -gravity north -geometry +0+100 -composite \
  -font "$font_file" -gravity center -fill white -pointsize 52 \
  -annotate +0-135 'Seven years later...' \
  -fill '#73d8ff' -pointsize 40 \
  -annotate +0-40 'Gearing up for Maker Faire' \
  -fill white -pointsize 34 \
  -annotate +0+35 'Mare Island  •  Sept 25–27, 2026' \
  -fill '#b9c7d6' -pointsize 25 \
  -annotate +0+140 'Follow Orbitus Robotica for the road to the show' \
  "$work_dir/end.png"

make_still_segment() {
  local image_file="$1"
  local duration="$2"
  local segment_file="$3"

  ffmpeg -loglevel error -y -loop 1 -t "$duration" -i "$image_file" \
    -an -vf 'scale=720:1280,format=yuv420p,fps=30' \
    -c:v libx264 -preset medium -crf 18 "$segment_file"
}

make_clip_segment() {
  local clip_file="$1"
  local start_time="$2"
  local duration="$3"
  local segment_file="$4"

  ffmpeg -loglevel error -y -ss "$start_time" -t "$duration" -i "$clip_file" \
    -an -vf \
    "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:color=#050b17,fade=t=in:st=0:d=0.20,fade=t=out:st=3.00:d=0.20,format=yuv420p,fps=30" \
    -c:v libx264 -preset medium -crf 18 "$segment_file"
}

make_still_segment "$work_dir/title.png" 2.5 "$work_dir/segment-00.mp4"
make_clip_segment "$source_dir/IMG_1099.MOV.mp4" 2.0 3.2 "$work_dir/segment-01.mp4"
make_clip_segment "$source_dir/IMG_1101.MOV.mp4" 5.0 3.2 "$work_dir/segment-02.mp4"
make_clip_segment "$source_dir/IMG_1102.MOV.mp4" 9.0 3.2 "$work_dir/segment-03.mp4"
make_clip_segment "$source_dir/IMG_1103.MOV.mp4" 18.0 3.2 "$work_dir/segment-04.mp4"
make_clip_segment "$source_dir/IMG_1104.MOV.mp4" 4.0 3.2 "$work_dir/segment-05.mp4"
make_clip_segment "$source_dir/IMG_1109.MOV.mp4" 1.0 3.2 "$work_dir/segment-06.mp4"
make_still_segment "$work_dir/end.png" 3.5 "$work_dir/segment-07.mp4"

ffmpeg -loglevel error -y \
  -i "$work_dir/segment-00.mp4" \
  -i "$work_dir/segment-01.mp4" \
  -i "$work_dir/segment-02.mp4" \
  -i "$work_dir/segment-03.mp4" \
  -i "$work_dir/segment-04.mp4" \
  -i "$work_dir/segment-05.mp4" \
  -i "$work_dir/segment-06.mp4" \
  -i "$work_dir/segment-07.mp4" \
  -filter_complex \
  '[0:v][1:v][2:v][3:v][4:v][5:v][6:v][7:v]concat=n=8:v=1:a=0[outv]' \
  -map '[outv]' -an -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -movflags +faststart "$output_file"

magick "$work_dir/title.png" -resize 1080x1920 "$cover_file"

ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt \
  -show_entries format=duration,size -of default=noprint_wrappers=1 "$output_file"
