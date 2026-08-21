FROM libretranslate/libretranslate:latest

ENV LT_HOST=0.0.0.0
ENV LT_LOAD_ONLY=en,hi

CMD ["sh", "-c", "libretranslate --host 0.0.0.0 --port ${PORT:-10000}"]