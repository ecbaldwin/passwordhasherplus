#! /bin/make

default: export passwordfortifier.html

version=$(shell grep "\"version\"" manifest.json  | cut -d: -f2 | cut -d\" -f2)

export=_export

zip=passwordfortifier-${version}.zip

export:
	if [ ! -e archive ] ; then mkdir archive; fi
	rm -f ${zip}
	zip archive/${zip} -r * --exclude archive/*
