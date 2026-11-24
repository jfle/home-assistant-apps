# Official AIOMetadata release image (multi-arch: arm64 + amd64, Alpine + Node). Supervisor 2026: FROM lives here.
FROM ghcr.io/cedya77/aiometadata:4.1.0

# Redis is AIOMetadata's cache: run it inside the app (bound to 127.0.0.1, data in /data/redis).
# The addon keeps its database and caches in /app/addon/data -> point that at the app's persistent /data/app.
RUN apk add --no-cache redis \
 && rm -rf /app/addon/data && ln -s /data/app /app/addon/data

COPY rootfs/ha-start.js /ha-start.js
ENTRYPOINT ["node", "/ha-start.js", "aiometadata"]
CMD []

HEALTHCHECK --interval=60s --timeout=10s --start-period=5m --retries=5 \
  CMD ["node", "-e", "require('https').get({host:'127.0.0.1',port:8455,path:'/health/live',rejectUnauthorized:false},r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"]