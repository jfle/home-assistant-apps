# Official AIOStreams release image (multi-arch: arm64 + amd64). Supervisor 2026: build.yaml is deprecated.
FROM ghcr.io/viren070/aiostreams:v2.38.1

# The official AIOStreams image is distroless (Node only, no shell tools): the launcher is plain Node too.
COPY rootfs/ha-start.js /ha-start.js
ENTRYPOINT ["/nodejs/bin/node", "/ha-start.js", "aiostreams"]
CMD []

# Home Assistant restarts the app when this fails (replaces the old "watchdog")
HEALTHCHECK --interval=60s --timeout=10s --start-period=90s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "require('https').get({host:'127.0.0.1',port:8454,path:'/',rejectUnauthorized:false},r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"]
