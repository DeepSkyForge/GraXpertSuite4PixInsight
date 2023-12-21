#!/bin/bash
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <filename>"
    exit 1
fi
filename="$1"

commit=$(git log -1 --format='%H')
tag=$(git tag -n --points-at $commit)
IFS=' ' read -r version release <<< $tag

line='#define VERSION "$version"'
if [[ $release != "" && $version != "" ]]; 
then
  sed -i -e '/^#define VERSION /c\#define VERSION "$line"'  "$filename"
else
  echo "ERROR: Could not retrieve git release tag"
  exit 1
fi
