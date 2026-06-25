document.addEventListener('alpine:init', () => {
  Alpine.data('pawlog', () => ({
    tree: [],

    selectedPath: null,
    journeyOpen: {},

    currentFile: null,
    loading: false,

    panelOpen: false,
    editingKey: null,
    editLabel: '',
    editContent: '',
    editNote: '',
    saving: false,
    saveSuccess: false,

    activeTab: 'edit',
    history: [],
    histLoading: false,

    selectedHashes: [],
    diffLines: [],
    diffLoading: false,
    restoringHash: null,

    newPageOpen: false,
    newPageJourney: '',
    newPageName: '',
    newPageSlug: '',
    newPageDesc: '',
    newPageSaving: false,
    newPageError: '',

    newKeyOpen: false,
    newKeyKey: '',
    newKeyLabel: '',
    newKeyDesc: '',
    newKeyContent: '',
    newKeySaving: false,
    newKeyError: '',

    editPageOpen: false,
    editPageName: '',
    editPageDesc: '',
    editPageSaving: false,
    editPageError: '',

    deletePagePending: false,
    deletePageSaving: false,

    deleteKeyPending: false,
    deleteKeySaving: false,

    editGroup: '',

    newKeyGroup: '',

    sectionOpen: false,
    sectionNewName: '',
    sectionEditIndex: -1,
    sectionEditName: '',
    sectionSaving: false,

    sidebarOpen: true,

    brandFilter: 'all',
    editBrand: '',
    newKeyBrand: '',

    dashboard: null,
    dashLoading: false,

    newJourneyOpen: false,
    newJourneyName: '',
    newJourneySlug: '',
    newJourneyDesc: '',
    newJourneySaving: false,
    newJourneyError: '',

    editJourneyOpen: false,
    editJourneySlug: '',
    editJourneyName: '',
    editJourneyDesc: '',
    editJourneySaving: false,
    editJourneyError: '',

    deleteJourneyPending: '',
    deleteJourneySaving: false,

    importing: false,
    importError: '',

    get filteredItems() {
      if (!this.currentFile) return {};
      const items = this.currentFile.items ?? {};
      if (this.brandFilter === 'all') return items;
      return Object.fromEntries(
        Object.entries(items).filter(([, item]) => {
          const b = item.brand ?? '';
          return b === '' || b === this.brandFilter;
        })
      );
    },

    get flatEntries() {
      if (!this.currentFile) return [];
      const groups = this.currentFile.meta.groups ?? [];
      const items = this.filteredItems;
      if (groups.length === 0) {
        return Object.entries(items).map(([key, item]) => ({ type: 'row', key, item }));
      }
      const buckets = {};
      for (const g of groups) buckets[g] = [];
      const ungrouped = [];
      for (const [key, item] of Object.entries(items)) {
        const g = item.group;
        if (g && buckets[g] !== undefined) buckets[g].push({ key, item });
        else ungrouped.push({ key, item });
      }
      const result = [];
      for (const g of groups) {
        result.push({ type: 'header', name: g });
        for (const e of buckets[g]) result.push({ type: 'row', key: e.key, item: e.item });
      }
      if (ungrouped.length > 0) {
        result.push({ type: 'header', name: '' });
        for (const e of ungrouped) result.push({ type: 'row', key: e.key, item: e.item });
      }
      return result;
    },

    cloneFile() {
      return JSON.parse(JSON.stringify(this.currentFile));
    },

    async saveFile(data, note) {
      await fetch('/api/file?path=' + encodeURIComponent(this.selectedPath), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, note })
      });
      this.currentFile = data;
    },

    toSlug(name) {
      return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    },

    async init() {
      this.sidebarOpen = window.innerWidth >= 768;
      window.addEventListener('resize', () => {
        if (window.innerWidth >= 768) this.sidebarOpen = true;
      });
      await Promise.all([this.loadTree(), this.loadDashboard()]);
    },

    async loadDashboard() {
      this.dashLoading = true;
      const res = await fetch('/api/dashboard');
      this.dashboard = await res.json();
      this.dashLoading = false;
    },

    async loadTree() {
      const res = await fetch('/api/tree');
      this.tree = await res.json();
    },

    async selectPage(path) {
      this.selectedPath = path;
      this.panelOpen = false;
      if (window.innerWidth < 768) this.sidebarOpen = false;
      this.deletePagePending = false;
      this.loading = true;
      const res = await fetch('/api/file?path=' + encodeURIComponent(path));
      this.currentFile = await res.json();
      this.loading = false;
    },

    openEditor(key) {
      const item = this.currentFile.items[key];
      this.editingKey = key;
      this.editLabel = item.label;
      this.editContent = item.content;
      this.editGroup = item.group ?? '';
      this.editBrand = item.brand ?? '';
      this.editNote = '';
      this.activeTab = 'edit';
      this.history = [];
      this.selectedHashes = [];
      this.diffLines = [];
      this.deleteKeyPending = false;
      this.restoringHash = null;
      this.panelOpen = true;
    },

    async saveItem() {
      if (!this.editingKey || !this.selectedPath) return;
      this.saving = true;
      const updated = this.cloneFile();
      updated.items[this.editingKey].content = this.editContent;
      if (this.editGroup) updated.items[this.editingKey].group = this.editGroup;
      else delete updated.items[this.editingKey].group;
      if (this.editBrand) updated.items[this.editingKey].brand = this.editBrand;
      else delete updated.items[this.editingKey].brand;
      await this.saveFile(updated, this.editNote);
      this.saving = false;
      this.saveSuccess = true;
      setTimeout(() => this.saveSuccess = false, 2000);
      if (this.activeTab === 'history') await this.loadHistory();
    },

    async deleteKey() {
      if (!this.editingKey || !this.selectedPath) return;
      this.deleteKeySaving = true;
      const updated = this.cloneFile();
      delete updated.items[this.editingKey];
      await this.saveFile(updated, 'Delete key: ' + this.editingKey);
      this.deleteKeySaving = false;
      this.deleteKeyPending = false;
      this.panelOpen = false;
    },

    async loadHistory() {
      this.histLoading = true;
      this.selectedHashes = [];
      this.diffLines = [];
      this.restoringHash = null;
      const res = await fetch('/api/log?path=' + encodeURIComponent(this.selectedPath));
      this.history = await res.json();
      this.histLoading = false;
    },

    async restoreVersion(hash) {
      if (!this.editingKey || !this.selectedPath) return;
      this.restoringHash = hash;
      const res = await fetch('/api/show?path=' + encodeURIComponent(this.selectedPath) + '&hash=' + hash);
      const raw = await res.text();
      let parsed;
      try { parsed = JSON.parse(raw); } catch { this.restoringHash = null; return; }
      const historicContent = parsed.items?.[this.editingKey]?.content;
      if (historicContent === undefined) { this.restoringHash = null; return; }
      const updated = this.cloneFile();
      updated.items[this.editingKey].content = historicContent;
      await this.saveFile(updated, 'Restore ' + this.editingKey + ' to ' + hash.substring(0, 7));
      this.editContent = historicContent;
      this.restoringHash = null;
      this.activeTab = 'edit';
      this.saveSuccess = true;
      setTimeout(() => this.saveSuccess = false, 2000);
    },

    toggleHashSelect(hash) {
      if (this.selectedHashes.includes(hash)) {
        this.selectedHashes = this.selectedHashes.filter(h => h !== hash);
      } else if (this.selectedHashes.length < 2) {
        this.selectedHashes.push(hash);
      } else {
        this.selectedHashes = [this.selectedHashes[1], hash];
      }
    },

    async loadDiff() {
      if (this.selectedHashes.length !== 2) return;
      this.diffLoading = true;
      const [a, b] = this.selectedHashes;
      const res = await fetch(
        '/api/diff?path=' + encodeURIComponent(this.selectedPath) +
        '&from=' + a + '&to=' + b
      );
      const raw = await res.text();
      this.diffLines = raw.split('\n');
      this.diffLoading = false;
    },

    async switchTab(tab) {
      this.activeTab = tab;
      if (tab === 'history' && this.history.length === 0) await this.loadHistory();
    },

    formatDate(iso) {
      return new Date(iso).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    },

    openNewPage(journeySlug) {
      this.newPageJourney = journeySlug;
      this.newPageName = '';
      this.newPageSlug = '';
      this.newPageDesc = '';
      this.newPageError = '';
      this.newPageOpen = true;
    },

    onPageNameInput() {
      this.newPageSlug = this.toSlug(this.newPageName);
    },

    async createPage() {
      this.newPageSaving = true;
      this.newPageError = '';
      try {
        const res = await fetch('/api/page', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            journey: this.newPageJourney,
            slug: this.newPageSlug,
            page: this.newPageName,
            description: this.newPageDesc,
          })
        });
        if (!res.ok) {
          const body = await res.json();
          this.newPageError = body.error || 'Failed to create page';
          return;
        }
        const { path } = await res.json();
        await this.loadTree();
        this.newPageOpen = false;
        this.journeyOpen[this.newPageJourney] = true;
        await this.selectPage(path);
      } finally {
        this.newPageSaving = false;
      }
    },

    openNewKey(group) {
      this.newKeyKey = '';
      this.newKeyLabel = '';
      this.newKeyDesc = '';
      this.newKeyContent = '';
      this.newKeyGroup = group || '';
      this.newKeyBrand = '';
      this.newKeyError = '';
      this.newKeyOpen = true;
    },

    openEditPage() {
      this.editPageName = this.currentFile.meta.page;
      this.editPageDesc = this.currentFile.meta.description ?? '';
      this.editPageError = '';
      this.editPageOpen = true;
    },

    async savePage() {
      if (!this.editPageName.trim()) {
        this.editPageError = 'Page name is required';
        return;
      }
      this.editPageSaving = true;
      this.editPageError = '';
      try {
        const res = await fetch('/api/page', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: this.selectedPath,
            page: this.editPageName,
            description: this.editPageDesc,
          })
        });
        if (!res.ok) {
          const body = await res.json();
          this.editPageError = body.error || 'Failed to update page';
          return;
        }
        await this.loadTree();
        await this.selectPage(this.selectedPath);
        this.editPageOpen = false;
      } finally {
        this.editPageSaving = false;
      }
    },

    async deletePage() {
      this.deletePageSaving = true;
      try {
        await fetch('/api/page', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: this.selectedPath })
        });
        this.selectedPath = null;
        this.currentFile = null;
        this.deletePagePending = false;
        await this.loadTree();
      } finally {
        this.deletePageSaving = false;
      }
    },

    openSections() {
      this.sectionNewName = '';
      this.sectionEditIndex = -1;
      this.sectionEditName = '';
      this.sectionOpen = true;
    },

    async addGroup() {
      const name = this.sectionNewName.trim();
      if (!name || (this.currentFile.meta.groups ?? []).includes(name)) return;
      this.sectionSaving = true;
      const updated = this.cloneFile();
      updated.meta.groups = [...(updated.meta.groups ?? []), name];
      await this.saveFile(updated, 'Add group: ' + name);
      this.sectionNewName = '';
      this.sectionSaving = false;
    },

    async renameGroup() {
      const groups = this.currentFile.meta.groups ?? [];
      const oldName = groups[this.sectionEditIndex];
      const newName = this.sectionEditName.trim();
      if (!newName || newName === oldName) { this.sectionEditIndex = -1; return; }
      this.sectionSaving = true;
      const updated = this.cloneFile();
      updated.meta.groups = updated.meta.groups.map((g, i) => i === this.sectionEditIndex ? newName : g);
      for (const item of Object.values(updated.items)) {
        if (item.group === oldName) item.group = newName;
      }
      await this.saveFile(updated, 'Rename group: ' + oldName + ' → ' + newName);
      this.sectionEditIndex = -1;
      this.sectionSaving = false;
    },

    async deleteGroup(name) {
      this.sectionSaving = true;
      const updated = this.cloneFile();
      updated.meta.groups = (updated.meta.groups ?? []).filter(g => g !== name);
      for (const item of Object.values(updated.items)) {
        if (item.group === name) delete item.group;
      }
      await this.saveFile(updated, 'Delete group: ' + name);
      this.sectionSaving = false;
    },

    openNewJourney() {
      this.newJourneyName = '';
      this.newJourneySlug = '';
      this.newJourneyDesc = '';
      this.newJourneyError = '';
      this.newJourneyOpen = true;
    },

    onJourneyNameInput() {
      this.newJourneySlug = this.toSlug(this.newJourneyName);
    },

    async createJourney() {
      this.newJourneySaving = true;
      this.newJourneyError = '';
      try {
        const res = await fetch('/api/journey', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: this.newJourneySlug,
            name: this.newJourneyName,
            description: this.newJourneyDesc,
          })
        });
        if (!res.ok) {
          const body = await res.json();
          this.newJourneyError = body.error || 'Failed to create journey';
          return;
        }
        await this.loadTree();
        this.newJourneyOpen = false;
        this.journeyOpen[this.newJourneySlug] = true;
      } finally {
        this.newJourneySaving = false;
      }
    },

    openEditJourney(journey) {
      this.editJourneySlug = journey.slug;
      this.editJourneyName = journey.name;
      this.editJourneyDesc = journey.description ?? '';
      this.editJourneyError = '';
      this.editJourneyOpen = true;
    },

    async saveJourney() {
      if (!this.editJourneyName.trim()) {
        this.editJourneyError = 'Journey name is required';
        return;
      }
      this.editJourneySaving = true;
      this.editJourneyError = '';
      try {
        const res = await fetch('/api/journey', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: this.editJourneySlug,
            name: this.editJourneyName,
            description: this.editJourneyDesc,
          })
        });
        if (!res.ok) {
          const body = await res.json();
          this.editJourneyError = body.error || 'Failed to update journey';
          return;
        }
        await this.loadTree();
        this.editJourneyOpen = false;
      } finally {
        this.editJourneySaving = false;
      }
    },

    async deleteJourney() {
      this.deleteJourneySaving = true;
      try {
        await fetch('/api/journey', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: this.deleteJourneyPending })
        });
        if (this.selectedPath?.startsWith(this.deleteJourneyPending + '/')) {
          this.selectedPath = null;
          this.currentFile = null;
        }
        this.deleteJourneyPending = '';
        await this.loadTree();
      } finally {
        this.deleteJourneySaving = false;
      }
    },

    triggerDownload(data, filename) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },

    async exportPage() {
      if (!this.selectedPath) return;
      const res = await fetch('/api/export?scope=page&path=' + encodeURIComponent(this.selectedPath));
      const data = await res.json();
      const filename = this.selectedPath.split('/').pop() || 'page.json';
      this.triggerDownload(data, filename);
    },

    async importPage(file) {
      if (!file || !this.selectedPath) return;
      this.importing = true;
      this.importError = '';
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const res = await fetch('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope: 'page', path: this.selectedPath, data, note: 'Import page' }),
        });
        const body = await res.json();
        if (!res.ok) { this.importError = body.error || 'Import failed'; return; }
        await this.selectPage(this.selectedPath);
      } catch {
        this.importError = 'Invalid JSON file';
      } finally {
        this.importing = false;
      }
    },

    async exportJourney(slug) {
      const res = await fetch('/api/export?scope=journey&slug=' + encodeURIComponent(slug));
      const data = await res.json();
      this.triggerDownload(data, slug + '.json');
    },

    async importJourney(slug, file) {
      if (!file) return;
      this.importing = true;
      this.importError = '';
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const res = await fetch('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope: 'journey', slug, data, note: 'Import journey: ' + slug }),
        });
        const body = await res.json();
        if (!res.ok) { this.importError = body.error || 'Import failed'; return; }
        await this.loadTree();
        if (this.selectedPath?.startsWith(slug + '/')) await this.selectPage(this.selectedPath);
      } catch {
        this.importError = 'Invalid JSON file';
      } finally {
        this.importing = false;
      }
    },

    async exportAll() {
      const res = await fetch('/api/export?scope=all');
      const data = await res.json();
      this.triggerDownload(data, 'pawlog-export.json');
    },

    async importAll(file) {
      if (!file) return;
      this.importing = true;
      this.importError = '';
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const res = await fetch('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope: 'all', data, note: 'Import all' }),
        });
        const body = await res.json();
        if (!res.ok) { this.importError = body.error || 'Import failed'; return; }
        await Promise.all([this.loadTree(), this.loadDashboard()]);
        if (this.selectedPath) await this.selectPage(this.selectedPath);
      } catch {
        this.importError = 'Invalid JSON file';
      } finally {
        this.importing = false;
      }
    },

    async createKey() {
      this.newKeyError = '';
      if (!/^[a-z][a-z0-9_]*$/.test(this.newKeyKey)) {
        this.newKeyError = 'Key must be snake_case (lowercase letters and underscores)';
        return;
      }
      if (this.currentFile.items[this.newKeyKey]) {
        this.newKeyError = 'Key already exists in this page';
        return;
      }
      if (!this.newKeyLabel.trim()) {
        this.newKeyError = 'Label is required';
        return;
      }
      this.newKeySaving = true;
      try {
        const item = { label: this.newKeyLabel.trim(), content: this.newKeyContent };
        if (this.newKeyDesc.trim()) item.description = this.newKeyDesc.trim();
        if (this.newKeyGroup) item.group = this.newKeyGroup;
        if (this.newKeyBrand) item.brand = this.newKeyBrand;
        const updated = this.cloneFile();
        updated.items[this.newKeyKey] = item;
        await this.saveFile(updated, 'Add key: ' + this.newKeyKey);
        this.newKeyOpen = false;
      } finally {
        this.newKeySaving = false;
      }
    },
  }));
});
