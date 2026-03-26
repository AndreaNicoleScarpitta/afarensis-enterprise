# 🚀 QUICK START - Play with Afarensis Enterprise UI/UX

**Want to immediately test the UI/UX?** Here are your fastest options:

## Option 1: Instant .exe Creation (Fastest)

1. **Open PowerShell/Command Prompt** in the `afarensis-enterprise` folder
2. **Run the build script:**
   ```cmd
   build_setup_exe.bat
   ```
   *OR*
   ```powershell
   .\build_setup_exe.ps1
   ```

3. **Wait 2-3 minutes** for build to complete

4. **Run the installer:**
   ```cmd
   .\dist\AfarensisEnterprise-Setup.exe
   ```

5. **Click "Start Setup"** and wait ~5 minutes

6. **Click "Open Application"** → Browser opens automatically

7. **Login:** `admin@afarensis.com` / `admin123`

**✨ You're now in the full Afarensis Enterprise UI!**

## Option 2: Direct Docker (If you have Docker)

```bash
# Quick Docker startup
cd afarensis-enterprise
docker-compose up -d

# Wait 2 minutes, then open:
http://localhost:3000
```

## Option 3: Frontend Only (Just UI)

```bash
cd frontend
npm install
npm start

# Opens at: http://localhost:3000
# (Backend features won't work, but you can see the UI)
```

---

## 🎯 What to Test in the UI

### **Dashboard** (`/dashboard`)
- **Smart Workflow Guide** - AI-powered next-step recommendations
- **Interactive Evidence Network** - 3D visualization with D3.js
- **Progressive Disclosure** - Adaptive UI based on expertise level
- **Real-time Collaboration** - Live cursors and comments

### **Projects** (`/projects`)
- **Project List** - Professional enterprise grid view
- **Project Creation** - Multi-step wizard with validation
- **Project Detail** - Comprehensive project management

### **Evidence Review** (`/evidence`)
- **Evidence Discovery** - Search across PubMed, ClinicalTrials.gov
- **Bias Analysis** - 11-type comprehensive bias detection
- **Comparability Scoring** - 6-dimensional evidence assessment

### **Analysis Tools** (`/analysis/`)
- **Comparability Analysis** - Statistical similarity assessment
- **Bias Detection** - Advanced AI-powered bias identification
- **Evidence Validation** - 3-stage validation pipeline

### **Regulatory Artifacts** (`/artifacts`)
- **Document Generation** - FDA-ready regulatory submissions
- **Artifact Download** - PDF/Word/Excel export functionality
- **Template Library** - Pre-built regulatory templates

### **Admin Features** (`/admin/`)
- **User Management** - Role-based access control (RBAC)
- **Audit Logs** - Comprehensive 7-year regulatory compliance
- **System Settings** - Configuration management

---

## 🎨 UI/UX Features to Explore

### **Design System**
- **Typography:** IBM Plex Serif/Sans professional fonts
- **Color Scheme:** Institutional blues, regulatory-focused
- **Responsive:** Mobile-first design with gesture support

### **Enhanced UX Components**
- **Smart Workflow Guide** - Context-aware recommendations
- **3D Evidence Network** - Force-directed graph visualization
- **Progressive Disclosure** - Adaptive complexity based on user role
- **Real-time Collaboration** - Google Docs-style live editing
- **Zero Trust Security Monitor** - Live security status dashboard

### **Interaction Patterns**
- **Drag & Drop:** File uploads, evidence organization
- **Live Search:** Real-time filtering and suggestions
- **Progressive Forms:** Multi-step wizards with validation
- **Contextual Actions:** Role-based available actions

---

## 🔧 Demo Data Available

The system comes pre-loaded with:
- **3 Sample Projects:** Alzheimer drug trials, oncology studies, diabetes devices
- **50+ Evidence Records:** Simulated PubMed and clinical trial data
- **Bias Analysis Examples:** Pre-configured detection examples
- **Regulatory Artifacts:** Sample FDA submission documents
- **User Accounts:** Admin, reviewer, analyst, viewer roles

---

## ⚡ Fastest Path to UI Testing

**If you just want to see the UI immediately:**

1. **Run:** `build_setup_exe.bat` *(2 minutes)*
2. **Run:** `.\dist\AfarensisEnterprise-Setup.exe` *(5 minutes)*
3. **Click:** "Open Application" *(instant)*
4. **Login:** `admin@afarensis.com` / `admin123` *(instant)*

**Total time:** ~7 minutes from start to full UI exploration

---

## 🎮 UI Testing Checklist

- [ ] Dashboard loads with interactive widgets
- [ ] Can create new project via wizard
- [ ] Evidence search and filtering works
- [ ] 3D evidence network renders and is interactive
- [ ] Bias analysis shows comprehensive results
- [ ] Regulatory artifacts can be generated
- [ ] User management shows role-based access
- [ ] Mobile responsive design works
- [ ] Real-time collaboration features function
- [ ] Progressive disclosure adapts to user role

---

**🎉 Ready to explore the enterprise-grade clinical evidence review platform!**
