#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
source_root="${GALLERY_SOURCE_DIR:-${repo_root}/media/gallery-originals}"
output_root="${GALLERY_OUTPUT_DIR:-${repo_root}/static/images/galleries}"
force_rebuild=0
safe_basename_pattern='^[A-Za-z0-9][A-Za-z0-9._-]*$'

if [[ "${1:-}" == "--force" ]]; then
    force_rebuild=1
    shift
fi

if ! image_tool="$(command -v magick)"; then
    echo "ImageMagick 7 is required (missing: magick)." >&2
    exit 1
fi

if ! video_tool="$(command -v ffmpeg)"; then
    echo "FFmpeg is required (missing: ffmpeg)." >&2
    exit 1
fi

if ! probe_tool="$(command -v ffprobe)"; then
    echo "FFprobe is required (missing: ffprobe)." >&2
    exit 1
fi

if ! node_tool="$(command -v node)"; then
    echo "Node.js 20 or newer is required (missing: node)." >&2
    exit 1
fi

node_major="$($node_tool -p 'process.versions.node.split(".")[0]')"
if [[ ! "$node_major" =~ ^[0-9]+$ || "$node_major" -lt 20 ]]; then
    echo "Node.js 20 or newer is required (found: $($node_tool --version))." >&2
    exit 1
fi

if [[ ! -d "$source_root" ]]; then
    echo "Gallery source directory does not exist: $source_root" >&2
    exit 1
fi

if [[ -L "$source_root" ]]; then
    echo "Gallery source directory must not be a symbolic link: $source_root" >&2
    exit 1
fi

albums=("$@")
if [[ ${#albums[@]} -eq 0 ]]; then
    for album_path in "$source_root"/*; do
        if [[ -L "$album_path" ]]; then
            echo "Gallery album must not be a symbolic link: $album_path" >&2
            exit 1
        fi
        [[ -d "$album_path" ]] || continue
        albums+=("$(basename "$album_path")")
    done
fi

for album in "${albums[@]}"; do
    if [[ ! "$album" =~ $safe_basename_pattern || "$album" == "." || "$album" == ".." || ${#album} -gt 255 ]]; then
        echo "Gallery album must be a single safe basename: $album" >&2
        exit 1
    fi
done

if [[ ${#albums[@]} -eq 0 ]]; then
    echo "No gallery albums found under $source_root" >&2
    exit 1
fi

needs_update() {
    local input="$1"
    local output="$2"
    [[ $force_rebuild -eq 1 || ! -s "$output" || "$input" -nt "$output" ]]
}

write_webp() {
    local input="$1"
    local output="$2"
    local geometry="$3"
    local quality="$4"
    local crop="${5:-0}"
    local temporary="${output%.webp}.gallery-tmp-$$.webp"
    local image_arguments=("${input}[0]" -auto-orient -colorspace sRGB -strip -filter Lanczos)

    if [[ "$crop" == "1" ]]; then
        image_arguments+=(-thumbnail "${geometry}^" -gravity center -extent "$geometry")
    else
        image_arguments+=(-resize "$geometry")
    fi
    image_arguments+=(-define webp:method=6 -define webp:use-sharp-yuv=true -quality "$quality" "$temporary")

    if ! "$image_tool" "${image_arguments[@]}"; then
        rm -f "$temporary"
        return 1
    fi

    "$image_tool" identify "$temporary" >/dev/null
    mv -f "$temporary" "$output"
}

write_video() {
    local input="$1"
    local output="$2"
    local temporary="${output%.mp4}.gallery-tmp-$$.mp4"
    local scale_filter="scale=w='if(gte(iw,ih),min(iw,1280),-2)':h='if(gte(iw,ih),-2,min(ih,1280))'"
    local video_arguments=(-hide_banner -nostdin -loglevel error -y -i "$input")
    video_arguments+=(-map 0:v:0 -map "0:a:0?" -map_metadata -1 -map_chapters -1 -vf "$scale_filter")
    video_arguments+=(-c:v libx264 -preset slow -crf 23 -maxrate 2500k -bufsize 5000k)
    video_arguments+=(-profile:v high -level:v 4.1 -pix_fmt yuv420p -g 60 -keyint_min 30 -threads 1)
    video_arguments+=(-c:a aac -b:a 128k -ac 2 -ar 48000 -movflags +faststart "$temporary")

    if ! "$video_tool" "${video_arguments[@]}"; then
        rm -f "$temporary"
        return 1
    fi

    "$probe_tool" -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "$temporary" | grep -qx "h264"
    mv -f "$temporary" "$output"
}

write_video_poster() {
    local input="$1"
    local thumb320="$2"
    local thumb640="$3"
    local display="$4"
    local frame="${display%.webp}.gallery-frame-$$.png"
    local poster_arguments=(-hide_banner -nostdin -loglevel error -y -ss 0.5 -i "$input")
    poster_arguments+=(-map 0:v:0 -frames:v 1 -map_metadata -1 "$frame")

    if ! "$video_tool" "${poster_arguments[@]}"; then
        rm -f "$frame"
        return 1
    fi

    write_webp "$frame" "$thumb320" "320x240" "68" "1"
    write_webp "$frame" "$thumb640" "640x480" "72" "1"
    write_webp "$frame" "$display" "1440x1440>" "76"
    rm -f "$frame"
}

generated=0
skipped=0
pruned=0

source_kind() {
    local source_name="$1"
    local source_extension
    source_extension="$(printf '%s' "${source_name##*.}" | tr '[:upper:]' '[:lower:]')"
    case "$source_extension" in
        heic|jpg|jpeg|png|webp) printf '%s\n' "image" ;;
        mov) printf '%s\n' "video" ;;
        *) printf '%s\n' "unsupported" ;;
    esac
}

prune_album_outputs() {
    local album_source="$1"
    local thumb_dir="$2"
    local display_dir="$3"
    local video_dir="$4"
    local candidate source_name kind

    for candidate in "$thumb_dir"/*; do
        [[ -f "$candidate" && ! -L "$candidate" ]] || continue
        source_name="$(basename "$candidate")"
        source_name="${source_name%-320.webp}"
        source_name="${source_name%-640.webp}"
        kind="$(source_kind "$source_name")"
        if [[ ! -f "$album_source/$source_name" || -L "$album_source/$source_name" || "$kind" == "unsupported" ]]; then
            rm -f -- "$candidate"
            pruned=$((pruned + 1))
        fi
    done

    for candidate in "$display_dir"/*; do
        [[ -f "$candidate" && ! -L "$candidate" ]] || continue
        source_name="$(basename "$candidate")"
        source_name="${source_name%.webp}"
        kind="$(source_kind "$source_name")"
        if [[ ! -f "$album_source/$source_name" || -L "$album_source/$source_name" || "$kind" == "unsupported" ]]; then
            rm -f -- "$candidate"
            pruned=$((pruned + 1))
        fi
    done

    for candidate in "$video_dir"/*; do
        [[ -f "$candidate" && ! -L "$candidate" ]] || continue
        source_name="$(basename "$candidate")"
        source_name="${source_name%.mp4}"
        kind="$(source_kind "$source_name")"
        if [[ ! -f "$album_source/$source_name" || -L "$album_source/$source_name" || "$kind" != "video" ]]; then
            rm -f -- "$candidate"
            pruned=$((pruned + 1))
        fi
    done
}

for album in "${albums[@]}"; do
    album_source="$source_root/$album"
    if [[ -L "$album_source" ]]; then
        echo "Gallery album must not be a symbolic link: $album_source" >&2
        exit 1
    fi
    if [[ ! -d "$album_source" ]]; then
        echo "Unknown gallery album: $album" >&2
        exit 1
    fi

    thumb_dir="$output_root/$album/thumb"
    display_dir="$output_root/$album/display"
    video_dir="$output_root/$album/video"
    mkdir -p "$thumb_dir" "$display_dir" "$video_dir"

    echo "Processing gallery album: $album"
    for input in "$album_source"/*; do
        if [[ -L "$input" ]]; then
            echo "Gallery media must not be a symbolic link: $input" >&2
            exit 1
        fi
        [[ -f "$input" ]] || continue
        filename="$(basename "$input")"
        if [[ ! "$filename" =~ $safe_basename_pattern || "$filename" == "." || "$filename" == ".." || ${#filename} -gt 255 ]]; then
            echo "Gallery media filename must be a single safe basename: $filename" >&2
            exit 1
        fi
        extension="$(printf '%s' "${filename##*.}" | tr '[:upper:]' '[:lower:]')"
        thumb320="$thumb_dir/${filename}-320.webp"
        thumb640="$thumb_dir/${filename}-640.webp"
        display="$display_dir/${filename}.webp"

        case "$extension" in
            heic|jpg|jpeg|png|webp)
                if needs_update "$input" "$thumb320"; then
                    write_webp "$input" "$thumb320" "320x240" "68" "1"
                    generated=$((generated + 1))
                else
                    skipped=$((skipped + 1))
                fi
                if needs_update "$input" "$thumb640"; then
                    write_webp "$input" "$thumb640" "640x480" "72" "1"
                    generated=$((generated + 1))
                else
                    skipped=$((skipped + 1))
                fi
                if needs_update "$input" "$display"; then
                    write_webp "$input" "$display" "1440x1440>" "76"
                    generated=$((generated + 1))
                else
                    skipped=$((skipped + 1))
                fi
                ;;
            mov)
                video="$video_dir/${filename}.mp4"
                if needs_update "$input" "$video"; then
                    write_video "$input" "$video"
                    generated=$((generated + 1))
                else
                    skipped=$((skipped + 1))
                fi
                if needs_update "$input" "$thumb320" || needs_update "$input" "$thumb640" || needs_update "$input" "$display"; then
                    write_video_poster "$input" "$thumb320" "$thumb640" "$display"
                    generated=$((generated + 3))
                else
                    skipped=$((skipped + 3))
                fi
                ;;
        esac
    done

    prune_album_outputs "$album_source" "$thumb_dir" "$display_dir" "$video_dir"
done

GALLERY_SOURCE_DIR="$source_root" "$node_tool" "$script_dir/build-gallery-manifest.mjs"
echo "Gallery media complete: $generated generated, $skipped already current, $pruned stale files pruned."
