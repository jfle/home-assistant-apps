# Base image and version live here (Supervisor 2026: build.yaml is deprecated). Multi-arch: arm64 + amd64.
FROM node:22-alpine

# The released Stremio addon, unchanged: https://github.com/jfle/aio-streams-subtitles-greek/releases
ARG APP_VERSION=3.0.0
RUN apk add --no-cache --virtual .fetch curl tar \
 && curl -fsSL "https://github.com/jfle/aio-streams-subtitles-greek/releases/download/v${APP_VERSION}/aio-streams-subtitles-greek-${APP_VERSION}.tar.gz" | tar -xz -C /opt \
 && mv /opt/aio-streams-subtitles-greek /opt/app \
 && apk del .fetch

COPY rootfs/ha-start.js /ha-start.js
ENTRYPOINT ["node", "/ha-start.js", "subtitles"]

# Home Assistant restarts the app when this fails (replaces the old "watchdog")
HEALTHCHECK --interval=60s --timeout=10s --start-period=60s --retries=3 \
  CMD ["node", "-e", "require('https').get({host:'127.0.0.1',port:8453,path:'/health',rejectUnauthorized:false},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]
