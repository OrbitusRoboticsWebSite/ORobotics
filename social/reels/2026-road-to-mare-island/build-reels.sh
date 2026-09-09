#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$script_dir/../../.." && pwd)"
output_dir="$script_dir/output"
font_file="/System/Library/Fonts/Supplemental/Verdana Bold.ttf"
music_file="${META_SOUND_TRACK:-}"

mkdir -p "$output_dir"

if [[ -n "$music_file" && ! -f "$music_file" ]]; then
  printf 'META_SOUND_TRACK does not exist: %s\n' "$music_file" >&2
  exit 1
fi

make_reel() {
  local number="$1"
  local slug="$2"
  local line_one="$3"
  local line_two="$4"
  local image_one="$5"
  local image_two="$6"
  local image_three="$7"
  local output_file="$output_dir/${number}-${slug}.mp4"
  local silent_file="$output_dir/.${number}-${slug}-silent.mp4"
  local cover_file="$output_dir/${number}-${slug}-cover.jpg"
  local overlay_file="$output_dir/.${number}-${slug}-overlay.png"
  local music_offset=$(( (10#$number - 1) * 3 % 48 ))

  magick -size 720x1280 xc:none \
    -fill '#07131FCC' -draw 'rectangle 0,0 720,245' \
    -fill '#07131FD1' -draw 'rectangle 0,1170 720,1280' \
    -font "$font_file" -gravity north \
    -fill '#64E9FF' -pointsize 27 -annotate +0+55 'ORBITUS ROBOTICA' \
    -fill white -pointsize 47 -annotate +0+105 "$line_one" \
    -fill '#B6FF68' -pointsize 39 -annotate +0+164 "$line_two" \
    -fill white -pointsize 28 -annotate +0+1190 'ROAD TO MARE ISLAND' \
    -fill '#64E9FF' -pointsize 24 -annotate +0+1230 'SEPT 25 - 27' \
    "$overlay_file"

  ffmpeg -y -loglevel error \
    -i "$repo_dir/$image_one" \
    -i "$repo_dir/$image_two" \
    -i "$repo_dir/$image_three" \
    -loop 1 -i "$overlay_file" \
    -filter_complex "
      [0:v]scale=900:1600:force_original_aspect_ratio=increase,
        crop=900:1600,
        zoompan=z='min(zoom+0.0010,1.10)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=105:s=720x1280:fps=30,
        trim=duration=3.5,setpts=PTS-STARTPTS[v0];
      [1:v]scale=900:1600:force_original_aspect_ratio=increase,
        crop=900:1600,
        zoompan=z='min(zoom+0.0010,1.10)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=105:s=720x1280:fps=30,
        trim=duration=3.5,setpts=PTS-STARTPTS[v1];
      [2:v]scale=900:1600:force_original_aspect_ratio=increase,
        crop=900:1600,
        zoompan=z='min(zoom+0.0010,1.10)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=105:s=720x1280:fps=30,
        trim=duration=3.5,setpts=PTS-STARTPTS[v2];
      [v0][v1][v2]concat=n=3:v=1:a=0,format=yuv420p[base];
      [base][3:v]overlay=0:0:shortest=1,
        drawbox=x=0:y=1270:w='iw*t/10.5':h=10:color=0xB6FF68@0.95:t=fill,
        format=yuv420p[video]
    " \
    -map "[video]" \
    -an \
    -c:v libx264 \
    -preset medium \
    -crf 21 \
    -r 30 \
    -movflags +faststart \
    "$silent_file"

  if [[ -n "$music_file" ]]; then
    ffmpeg -y -loglevel error \
      -ss "$music_offset" -i "$music_file" \
      -i "$silent_file" \
      -filter_complex "[0:a]atrim=duration=10.5,asetpts=PTS-STARTPTS,volume=0.82,afade=t=in:st=0:d=0.25,afade=t=out:st=9.75:d=0.75[music]" \
      -map 1:v:0 -map "[music]" \
      -c:v copy -c:a aac -b:a 192k -shortest \
      -movflags +faststart \
      "$output_file"
  else
    mv "$silent_file" "$output_file"
  fi

  ffmpeg -y -loglevel error -ss 1.0 -i "$output_file" \
    -frames:v 1 -q:v 2 "$cover_file"

  rm -f "$overlay_file" "$silent_file"
}

make_reel "01" "cardboard-before-metal" \
  "CARDBOARD FIRST" "METAL LATER" \
  "assets/images/pages/Makerfaire_2019.webp" \
  "static/images/galleries/2019/display/IMG_1098.HEIC.webp" \
  "static/images/galleries/2020/display/IMG_0996.HEIC.webp"

make_reel "02" "systems-hunt-2020" \
  "2020 SYSTEMS HUNT" "ONE ROBOT - FIVE TEAMS" \
  "static/images/galleries/2020/display/IMG_0996.HEIC.webp" \
  "static/images/galleries/2020/display/IMG_0997.HEIC.webp" \
  "static/images/galleries/2020/display/IMG_0998.HEIC.webp"

make_reel "03" "open-the-panel-2021" \
  "OPEN THE PANEL" "SERVICEABILITY MATTERS" \
  "static/images/galleries/2021/display/IMG_1420.JPG.webp" \
  "static/images/galleries/2021/display/IMG_1421.JPG.webp" \
  "static/images/galleries/2021/display/IMG_1424.JPG.webp"

make_reel "04" "integration-year-2022" \
  "2022 INTEGRATION" "EVERY PART DEPENDS" \
  "static/images/galleries/2022/display/IMG_0171.HEIC.webp" \
  "static/images/galleries/2022/display/IMG_0205.HEIC.webp" \
  "static/images/galleries/2022/display/IMG_0175.HEIC.webp"

make_reel "05" "rob-meets-a-dragon" \
  "ROB MEETS A DRAGON" "MAKER FAIRE 2023" \
  "static/images/galleries/2023_MakerFaire/display/IMG_1370.HEIC.webp" \
  "static/images/galleries/2023_MakerFaire/display/IMG_1381.HEIC.webp" \
  "static/images/galleries/2023_MakerFaire/display/IMG_1383.HEIC.webp"

make_reel "06" "mare-island-2024" \
  "MARE ISLAND 2024" "QUESTIONS IN THE CROWD" \
  "static/images/galleries/2024_MakerFaire/display/IMG_4404.HEIC.webp" \
  "static/images/galleries/2024_MakerFaire/display/IMG_4405.HEIC.webp" \
  "static/images/galleries/2024_MakerFaire/display/IMG_4406.HEIC.webp"

make_reel "07" "drivetrain-rebuild" \
  "DRIVETRAIN REBUILD" "MEASURE - TEST - REPEAT" \
  "static/images/galleries/2024/display/IMG_4329.HEIC.webp" \
  "static/images/galleries/2024/display/IMG_4332.HEIC.webp" \
  "static/images/galleries/2024/display/IMG_4329.HEIC.webp"

make_reel "08" "neck-gears-2025" \
  "NECK GEARS 2025" "MOTION NEEDS LIMITS" \
  "static/images/galleries/2025/display/IMG_6055.HEIC.webp" \
  "static/images/galleries/2025/display/IMG_6022.HEIC.webp" \
  "static/images/galleries/2025/display/IMG_6055.HEIC.webp"

make_reel "09" "chessboard-geometry" \
  "CHESSBOARD GEOMETRY" "PIXELS TO COORDINATES" \
  "static/images/galleries/2025/display/IMG_6098.HEIC.webp" \
  "static/images/galleries/2026/display/IMG_6098.HEIC.webp" \
  "static/images/galleries/2025/display/IMG_6098.HEIC.webp"

make_reel "10" "seven-years" \
  "SEVEN YEARS" "ONE EVOLVING ROBOT" \
  "static/images/galleries/2019/display/IMG_1098.HEIC.webp" \
  "static/images/galleries/2024_MakerFaire/display/IMG_4406.HEIC.webp" \
  "static/images/galleries/2026/display/IMG_6318.HEIC.webp"

make_reel "11" "signal-to-motion" \
  "SIGNAL TO MOTION" "THE BUILDING R.O.B. BOOKS" \
  "static/images/books/volume-2-circuits-and-signals.webp" \
  "static/images/books/volume-3-motion-workshop.webp" \
  "static/images/books/volume-4-mission-control.webp"

make_reel "12" "stop-is-a-feature" \
  "STOP IS A FEATURE" "SAFETY IS A SYSTEM" \
  "static/images/galleries/2025/display/IMG_6022.HEIC.webp" \
  "static/images/galleries/2025/display/IMG_6055.HEIC.webp" \
  "static/images/galleries/2024/display/IMG_4332.HEIC.webp"

make_reel "13" "label-everything" \
  "LABEL EVERYTHING" "FUTURE YOU SAYS THANKS" \
  "static/images/galleries/2025/display/IMG_6022.HEIC.webp" \
  "static/images/galleries/2021/display/IMG_1424.JPG.webp" \
  "static/images/galleries/2020/display/IMG_0997.HEIC.webp"

make_reel "14" "engineering-with-character" \
  "SERIOUS ENGINEERING" "MAXIMUM CHARACTER" \
  "static/images/galleries/2026/display/IMG_6296.HEIC.webp" \
  "static/images/galleries/2026/display/IMG_6318.HEIC.webp" \
  "static/images/galleries/2026/display/IMG_6296.HEIC.webp"

make_reel "15" "road-to-mare-island" \
  "ROAD TO MARE ISLAND" "SEPTEMBER 25 - 27" \
  "static/images/galleries/2023_MakerFaire/display/IMG_1383.HEIC.webp" \
  "static/images/galleries/2024_MakerFaire/display/IMG_4406.HEIC.webp" \
  "static/images/galleries/2026/display/IMG_6318.HEIC.webp"

printf 'Built 15 reels in %s\n' "$output_dir"
