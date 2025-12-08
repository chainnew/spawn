# spawn.new WebVM Custom Image

Custom Debian image for spawn.new with Node.js, pnpm, Python, and Rust pre-installed.

## What's Included

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20.x LTS | Latest LTS |
| pnpm | latest | Fast package manager |
| Python | 3.11 | With pip and venv |
| Rust | stable | Via rustup |
| Git | latest | For cloning repos |
| Build tools | gcc, make, etc. | For native modules |

**Global npm packages:** typescript, tsx, vite, eslint, prettier

## Deploy to Your Fork

### 1. Clone your fork
```bash
git clone https://github.com/chainnew/webvm.git
cd webvm
```

### 2. Copy the Dockerfile
```bash
cp /Volumes/Iron/spawn/webvm-config/spawn_dev dockerfiles/spawn_dev
```

### 3. Push to GitHub
```bash
git add dockerfiles/spawn_dev
git commit -m "Add spawn.new custom image"
git push
```

### 4. Run the Deploy workflow

1. Go to your fork: https://github.com/chainnew/webvm
2. Click **Actions** tab
3. Click **Deploy** workflow
4. Click **Run workflow**
5. Set "Path to Dockerfile" to: `dockerfiles/spawn_dev`
6. Click **Run workflow**

The workflow will:
- Build the Docker image
- Convert to ext2 filesystem
- Deploy to GitHub Pages
- Give you a URL like: `https://chainnew.github.io/webvm/`

### 5. Get the disk image URL

After deploy, your disk image will be at:
```
https://github.com/chainnew/webvm/releases/download/ext2_image/spawn_dev_YYYYMMDD_BUILDID.ext2
```

## Use in spawn.new

Update `web/src/lib/webvm.ts`:

```typescript
const DISK_IMAGES = {
  spawn: {
    name: 'spawn.new Dev',
    url: 'https://github.com/chainnew/webvm/releases/download/ext2_image/spawn_dev_XXXXX.ext2',
    size: '~800MB',
    description: 'Node 20, pnpm, Python 3.11, Rust'
  },
  // ... other images
}
```

## Estimated Image Size

| Component | Size |
|-----------|------|
| Base Debian | ~200MB |
| Node.js 20 | ~100MB |
| Python 3 | ~100MB |
| Rust toolchain | ~300MB |
| Build tools | ~100MB |
| **Total** | **~800MB** |

Much smaller than the full 1.4GB Debian image since we skip X11/GUI stuff!

## Testing Locally

```bash
# Build the image
docker build -t spawn-dev -f dockerfiles/spawn_dev .

# Run it
docker run -it spawn-dev

# You should see:
#   ⚡ spawn.new sandbox
#   📁 ~/workspace  •  node v20.x.x  •  pnpm 9.x.x
```

## Customization

Edit `spawn_dev` Dockerfile to add more tools:

```dockerfile
# Add Bun
RUN curl -fsSL https://bun.sh/install | bash

# Add Deno
RUN curl -fsSL https://deno.land/install.sh | sh

# Add Go
RUN wget https://go.dev/dl/go1.21.0.linux-386.tar.gz \
    && tar -C /usr/local -xzf go1.21.0.linux-386.tar.gz
```

## Mount Points

When running in browser, CheerpX will mount:

| Path | Type | Persistent |
|------|------|------------|
| `/` | ext2 (read-only) | ❌ CDN |
| `/home/user` | idbfs | ✅ IndexedDB |
| `/workspace` | idbfs | ✅ IndexedDB |
| `/tmp` | tmpfs | ❌ RAM |

Your cloned repos in `/workspace` survive browser refresh! 🎉
