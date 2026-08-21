FROM libretranslate/libretranslate:latest

ENV LT_HOST=0.0.0.0
ENV LT_PORT=10000

CMD ["sh", "-c", "libretranslate --host 0.0.0.0 --port ${PORT:-10000}"]

EXPOSE 10000