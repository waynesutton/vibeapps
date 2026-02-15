# Convex Environment Variable Fix Guide

## Problem

When running `npx convex dev` from other folders or terminals, Convex tries to read `.env.local` and `CONVEX_DEPLOY_KEY` from the wrong location, causing it to connect to the wrong deployment.

Symptoms:
- `npx convex dev` connects to wrong deployment
- Schema validation errors
- Incorrect `CONVEX_DEPLOYMENT` or `CONVEX_DEPLOY_KEY` values
- `.env.local` gets overwritten with wrong deployment info

## Diagnosis

### Check Current Environment Variables

```bash
# See all Convex-related environment variables currently set
env | grep -i convex

# See the full environment (look for CONVEX_DEPLOY_KEY)
env | grep CONVEX

# See what's currently exported
export | grep CONVEX
```

### Check for Parent Directory .env.local Files

Convex may walk up the directory tree and find `.env.local` files in parent directories:

```bash
# Find all .env files in parent directories
find ~/Documents/sites -maxdepth 2 -name ".env*" -type f 2>/dev/null | grep -v node_modules
```

### Check Shell Config Files

Check if Convex variables are set in shell configuration files:

```bash
# Check each config file
grep -n "CONVEX" ~/.zshrc 2>/dev/null
grep -n "CONVEX" ~/.zshenv 2>/dev/null  
grep -n "CONVEX" ~/.zprofile 2>/dev/null
grep -n "CONVEX" ~/.bash_profile 2>/dev/null
grep -n "CONVEX" ~/.bashrc 2>/dev/null
```

Or check all at once:

```bash
for file in ~/.zshrc ~/.zshenv ~/.zprofile ~/.bash_profile ~/.bashrc ~/.profile; do 
  echo "=== $file ==="
  [ -f "$file" ] && grep -n "CONVEX" "$file" 2>/dev/null || echo "File does not exist"
  echo ""
done
```

## Fix

### Step 1: Unset Global Environment Variables

```bash
# Unset the global variables
unset CONVEX_DEPLOY_KEY
unset CONVEX_DEPLOYMENT

# Verify they're gone
env | grep CONVEX
```

### Step 2: Remove Parent Directory .env.local Files

If you find `.env.local` files in parent directories (like `~/Documents/sites/.env.local`), remove or rename them:

```bash
# Rename it (safer than deleting)
mv ~/Documents/sites/.env.local ~/Documents/sites/.env.local.backup

# Or delete if you're sure
rm ~/Documents/sites/.env.local
```

### Step 3: Restart Your Terminal

```bash
# Restart your terminal or run:
exec zsh
```

### Step 4: Verify Fix

```bash
# Navigate to your project
cd /path/to/your/project

# Check environment variables are gone
env | grep CONVEX

# Run Convex dev - should now use project's .env.local
npx convex dev
```

## Prevention

1. **Never export Convex variables globally** - Don't add `export CONVEX_DEPLOY_KEY=...` to your `.zshrc`, `.bash_profile`, or other shell config files

2. **Use project-specific .env.local files** - Each project should have its own `.env.local` file in the project root

3. **Avoid parent directory .env.local files** - Don't create `.env.local` files in parent directories that might be picked up by child projects

4. **Check before running commands** - If you're unsure, check your environment variables before running `npx convex dev`:
   ```bash
   env | grep CONVEX
   ```

## Quick Reference Commands

```bash
# Check current Convex environment variables
env | grep CONVEX

# Unset Convex variables
unset CONVEX_DEPLOY_KEY
unset CONVEX_DEPLOYMENT

# Find .env files that might interfere
find ~/Documents/sites -maxdepth 3 -name ".env*" -type f 2>/dev/null | grep -v node_modules

# Restart shell
exec zsh

# Verify fix
cd /path/to/project && env | grep CONVEX && npx convex dev
```
