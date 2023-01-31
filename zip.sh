#!/bin/bash

name=`cat package.json | jq -r '.name'`
rm "$name.zip"
zip -r "$name.zip" . -x .DS_Store zip.sh "./.git/*" "./node_modules/*" "./ui/*"