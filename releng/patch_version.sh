#!/bin/bash
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <filename>"
    exit 1
fi
filename="$1"

commit=$(git log -1 --format='%H')
tag=$(git tag -n --points-at $commit)
IFS=' ' read -r version release <<< $tag

if [[ $release != "" && $version != "" ]]; 
then
  sed -i "/^#define VERSION /c\#define VERSION \"$version\"" "$filename"
else
  echo "ERROR: Could not retrieve git release tag"
  exit 1
fi

echo "Define VERSION as \"$version\" in \"$filename\"."
