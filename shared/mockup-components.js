"use strict";
(() => {
  // overlay/src/svg-icons.ts
  var PENCIL_SVG = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M15,0H1C0.448,0,0,0.448,0,1v9c0,0.552,0.448,1,1,1h2.882l-1.776,3.553c-0.247,0.494-0.047,1.095,0.447,1.342C2.696,15.966,2.849,16,2.999,16c0.367,0,0.72-0.202,0.896-0.553L4.618,14h6.764l0.724,1.447C12.281,15.798,12.634,16,13.001,16c0.15,0,0.303-0.034,0.446-0.105c0.494-0.247,0.694-0.848,0.447-1.342L12.118,11H15c0.552,0,1-0.448,1-1V1C16,0.448,15.552,0,15,0z M5.618,12l0.5-1h3.764l0.5,1H5.618z M14,9H2V2h12V9z"/></svg>`;
  var CHEVRON_SVG = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
  var RESELECT_SVG = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M14,0H2C.895,0,0,.895,0,2V14c0,1.105,.895,2,2,2H6c.552,0,1-.448,1-1h0c0-.552-.448-1-1-1H2V2H14V6c0,.552,.448,1,1,1h0c.552,0,1-.448,1-1V2c0-1.105-.895-2-2-2Z"/><path d="M12.043,10.629l2.578-.644c.268-.068,.43-.339,.362-.607-.043-.172-.175-.308-.345-.358l-7-2c-.175-.051-.363-.002-.492,.126-.128,.129-.177,.317-.126,.492l2,7c.061,.214,.257,.362,.48,.362h.009c.226-.004,.421-.16,.476-.379l.644-2.578,3.664,3.664c.397,.384,1.03,.373,1.414-.025,.374-.388,.374-1.002,0-1.389l-3.664-3.664Z"/></svg>`;
  var SELECT_SVG = RESELECT_SVG;
  var INSERT_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><rect x="4" y="2" width="16" height="8" rx="2"/><path d="m17,14h1c1.105,0,2,.895,2,2"/><path d="m4,16c0-1.105.895-2,2-2h1"/><path d="m7,22h-1c-1.105,0-2-.895-2-2"/><path d="m20,20c0,1.105-.895,2-2,2h-1"/><line x1="13" y1="14" x2="11" y2="14"/><line x1="13" y1="22" x2="11" y2="22"/></svg>`;
  var TEXT_SVG = `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M14.895,2.553l-1-2c-.169-.339-.516-.553-.895-.553H3c-.379,0-.725,.214-.895,.553L1.105,2.553c-.247,.494-.047,1.095,.447,1.342,.496,.248,1.095,.046,1.342-.447l.724-1.447h3.382V14h-2c-.552,0-1,.448-1,1s.448,1,1,1h6c.552,0,1-.448,1-1s-.448-1-1-1h-2V2h3.382l.724,1.447c.175,.351,.528,.553,.896,.553,.15,0,.303-.034,.446-.105,.494-.247,.694-.848,.447-1.342Z"/></svg>`;
  var REPLACE_SVG = `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M6,15H1a1,1,0,0,1-1-1V2A1,1,0,0,1,1,1H6A1,1,0,0,1,7,2V14A1,1,0,0,1,6,15Z"/><rect x="9" y="6" width="2" height="4"/><path d="M14,13H11V12H9v2a1,1,0,0,0,1,1h5a1,1,0,0,0,1-1V12H14Z"/><path d="M15,1H10A1,1,0,0,0,9,2V4h2V3h3V4h2V2A1,1,0,0,0,15,1Z"/><rect x="14" y="6" width="2" height="4"/></svg>`;
  var SEND_SVG = `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M15.7,7.3l-14-7C1.4,0.1,1.1,0.1,0.8,0.3C0.6,0.4,0.5,0.7,0.5,1l1.8,6H9v2H2.3L0.5,15c-0.1,0.3,0,0.6,0.2,0.7C0.8,15.9,1,16,1.1,16c0.1,0,0.3,0,0.4-0.1l14-7C15.8,8.7,16,8.4,16,8S15.8,7.3,15.7,7.3z"/></svg>`;
  var MIC_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1.5 4v7a1.5 1.5 0 0 0 3 0V5a1.5 1.5 0 0 0-3 0zM6 11a1 1 0 0 1 1 1 5 5 0 0 0 10 0 1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V21h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.07A7 7 0 0 1 5 12a1 1 0 0 1 1-1z"/></svg>`;
  var BACK_SVG = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2L4 8l6 6"/></svg>`;
  var DESCRIBE_SVG = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12M2 8h8M2 12h10"/></svg>`;
  var DRAG_GRIP_SVG = `<svg viewBox="0 0 6 10" fill="currentColor"><circle cx="1.5" cy="1.5" r="1"/><circle cx="4.5" cy="1.5" r="1"/><circle cx="1.5" cy="5" r="1"/><circle cx="4.5" cy="5" r="1"/><circle cx="1.5" cy="8.5" r="1"/><circle cx="4.5" cy="8.5" r="1"/></svg>`;

  // overlay/src/web-components/vb-button.ts
  var ICON_MAP = {
    select: SELECT_SVG,
    insert: INSERT_SVG,
    grip: DRAG_GRIP_SVG,
    mic: MIC_SVG,
    pencil: PENCIL_SVG,
    send: SEND_SVG,
    text: TEXT_SVG,
    chevron: CHEVRON_SVG,
    replace: REPLACE_SVG,
    back: BACK_SVG,
    describe: DESCRIBE_SVG
  };
  var VbButton = class extends HTMLElement {
    btn = null;
    iconSpan = null;
    labelSpan = null;
    observer = null;
    static get observedAttributes() {
      return ["structure", "size", "theme", "state", "icon"];
    }
    /* ── Attribute accessors ─────────────────────────────────────────── */
    get structure() {
      return this.getAttribute("structure") || "ghost";
    }
    set structure(v) {
      this.setAttribute("structure", v);
    }
    get size() {
      return this.getAttribute("size") || "md";
    }
    set size(v) {
      this.setAttribute("size", v);
    }
    get theme() {
      return this.getAttribute("theme") || "neutral";
    }
    set theme(v) {
      this.setAttribute("theme", v);
    }
    get state() {
      return this.getAttribute("state") || "default";
    }
    set state(v) {
      this.setAttribute("state", v);
    }
    get icon() {
      return this.getAttribute("icon");
    }
    set icon(v) {
      if (v) this.setAttribute("icon", v);
      else this.removeAttribute("icon");
    }
    /* ── Lifecycle ───────────────────────────────────────────────────── */
    connectedCallback() {
      this.style.display = "contents";
      if (!this.btn) this.render();
      this.observer = new MutationObserver(() => this.updateContentClass());
      this.observer.observe(this, { childList: true, characterData: true, subtree: true });
    }
    disconnectedCallback() {
      this.observer?.disconnect();
      this.observer = null;
    }
    attributeChangedCallback(name, oldVal, newVal) {
      if (oldVal === newVal) return;
      if (!this.btn) return;
      if (name === "icon") {
        this.updateIcon();
        this.updateContentClass();
      }
      this.syncClasses();
    }
    /* ── Rendering ───────────────────────────────────────────────────── */
    render() {
      const labelText = this.collectAndRemoveTextNodes();
      this.btn = document.createElement("button");
      this.btn.type = "button";
      this.iconSpan = document.createElement("span");
      this.iconSpan.className = "vb-btn__icon";
      this.btn.appendChild(this.iconSpan);
      this.labelSpan = document.createElement("span");
      this.labelSpan.className = "vb-btn__label";
      this.labelSpan.textContent = labelText;
      this.labelSpan.style.display = labelText ? "" : "none";
      this.btn.appendChild(this.labelSpan);
      this.updateIcon();
      this.syncClasses();
      this.appendChild(this.btn);
    }
    /** Collect text from child text nodes and remove them from the DOM. */
    collectAndRemoveTextNodes() {
      let text = "";
      const toRemove = [];
      for (const node of this.childNodes) {
        if (node === this.btn) continue;
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.textContent || "";
          toRemove.push(node);
        }
      }
      for (const node of toRemove) node.remove();
      return text.trim();
    }
    updateIcon() {
      if (!this.iconSpan) return;
      const iconName = this.icon;
      if (iconName && ICON_MAP[iconName]) {
        this.iconSpan.innerHTML = ICON_MAP[iconName];
        this.iconSpan.style.display = "";
      } else if (iconName) {
        this.iconSpan.innerHTML = "";
        this.iconSpan.style.display = "none";
      } else {
        this.iconSpan.innerHTML = "";
        this.iconSpan.style.display = "none";
      }
    }
    updateLabel() {
      if (!this.labelSpan) return;
      const text = this.collectAndRemoveTextNodes();
      if (text) {
        this.labelSpan.textContent = text;
        this.labelSpan.style.display = "";
      }
    }
    updateContentClass() {
      this.updateLabel();
      this.syncClasses();
    }
    /* ── Class sync ──────────────────────────────────────────────────── */
    syncClasses() {
      if (!this.btn) return;
      const hasIcon = !!(this.icon && ICON_MAP[this.icon]);
      const hasLabel = !!(this.labelSpan && this.labelSpan.style.display !== "none");
      const state = this.state;
      const classes = ["vb-btn"];
      classes.push(`vb-btn--${this.structure}`);
      classes.push(`vb-btn--${this.size}`);
      classes.push(`vb-btn--${this.theme}`);
      if (state !== "default") {
        classes.push(`vb-btn--${state}`);
      }
      if (hasIcon && hasLabel) {
        classes.push("vb-btn--icon-text");
      } else if (hasIcon) {
        classes.push("vb-btn--icon-only");
      } else if (hasLabel) {
        classes.push("vb-btn--text-only");
      }
      this.btn.disabled = state === "disabled";
      this.btn.className = classes.join(" ");
    }
  };
  if (!customElements.get("vb-button")) {
    customElements.define("vb-button", VbButton);
  }

  // overlay/src/web-components/vb-button-group.ts
  var VbButtonGroup = class extends HTMLElement {
    wrapper = null;
    sepEl = null;
    adjunctBtn = null;
    observer = null;
    static get observedAttributes() {
      return ["count"];
    }
    get count() {
      return parseInt(this.getAttribute("count") || "0", 10);
    }
    set count(v) {
      this.setAttribute("count", String(v));
    }
    connectedCallback() {
      this.style.display = "contents";
      if (!this.wrapper) this.render();
      this.observer = new MutationObserver(() => this.syncGroupClasses());
      this.observer.observe(this, { subtree: true, attributes: true, attributeFilter: ["theme", "state"] });
    }
    disconnectedCallback() {
      this.observer?.disconnect();
      this.observer = null;
    }
    attributeChangedCallback(name, oldVal, newVal) {
      if (oldVal === newVal) return;
      if (name === "count") this.updateAdjunct();
    }
    render() {
      const children = [];
      while (this.firstChild) {
        children.push(this.removeChild(this.firstChild));
      }
      this.wrapper = document.createElement("div");
      this.wrapper.className = "vb-btn-group";
      for (const child of children) {
        this.wrapper.appendChild(child);
      }
      this.sepEl = document.createElement("div");
      this.sepEl.className = "vb-btn-group__sep";
      this.wrapper.appendChild(this.sepEl);
      this.adjunctBtn = document.createElement("button");
      this.adjunctBtn.type = "button";
      this.adjunctBtn.className = "vb-btn-group__adjunct";
      this.adjunctBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        console.log("[vb-button-group] adjunct click \u2014 dispatching adjunct-click event");
        this.dispatchEvent(new CustomEvent("adjunct-click", { bubbles: true }));
      });
      this.wrapper.appendChild(this.adjunctBtn);
      this.appendChild(this.wrapper);
      this.updateAdjunct();
      this.syncGroupClasses();
    }
    updateAdjunct() {
      if (!this.adjunctBtn || !this.sepEl) return;
      const count = this.count;
      if (count > 0) {
        this.adjunctBtn.innerHTML = `${count}<span class="vb-btn-group__plus">+</span>`;
        this.adjunctBtn.title = `${count} matching element${count !== 1 ? "s" : ""} selected`;
        this.adjunctBtn.style.display = "";
        this.sepEl.style.display = "";
      } else {
        this.adjunctBtn.style.display = "none";
        this.sepEl.style.display = "none";
      }
    }
    /** Sync group wrapper classes from the child <vb-button>'s theme/state. */
    syncGroupClasses() {
      if (!this.wrapper) return;
      const childBtn = this.querySelector("vb-button");
      const theme = childBtn?.getAttribute("theme") || "neutral";
      const state = childBtn?.getAttribute("state") || "default";
      this.wrapper.className = "vb-btn-group";
      this.wrapper.classList.add(`vb-btn-group--${theme}`);
      if (state !== "default") {
        this.wrapper.classList.add(`vb-btn-group--${state}`);
      }
    }
  };
  if (!customElements.get("vb-button-group")) {
    customElements.define("vb-button-group", VbButtonGroup);
  }

  // overlay/src/web-components/vb-bottom-toolbar.ts
  var STATE_MAP = {
    picking: "armed",
    engaged: "active",
    completed: "fulfilled",
    dim: "dim"
  };
  var VbBottomToolbar = class extends HTMLElement {
    toolbar = null;
    selectBtnEl = null;
    insertBtnEl = null;
    selectGroupEl = null;
    userDragged = false;
    constructor() {
      super();
    }
    static get observedAttributes() {
      return ["selected-tool", "instance-count", "disabled"];
    }
    get selectedTool() {
      return this.getAttribute("selected-tool") || null;
    }
    set selectedTool(tool) {
      if (tool) {
        this.setAttribute("selected-tool", tool);
      } else {
        this.removeAttribute("selected-tool");
      }
    }
    get instanceCount() {
      return parseInt(this.getAttribute("instance-count") || "0", 10);
    }
    set instanceCount(count) {
      this.setAttribute("instance-count", String(count));
    }
    get isDisabled() {
      return this.hasAttribute("disabled");
    }
    set isDisabled(val) {
      if (val) {
        this.setAttribute("disabled", "");
      } else {
        this.removeAttribute("disabled");
      }
    }
    connectedCallback() {
      this.style.display = "contents";
      this.render();
    }
    attributeChangedCallback(name, oldVal, newVal) {
      if (oldVal === newVal) return;
      this.updateButtonStates();
    }
    show() {
      this.style.display = "flex";
      this.centerToolbar();
    }
    hide() {
      this.style.display = "none";
    }
    render() {
      if (this.toolbar) return;
      const toolbar = document.createElement("div");
      toolbar.className = "bottom-toolbar";
      const grip = document.createElement("div");
      grip.className = "bt-grip";
      grip.title = "Drag to move";
      grip.innerHTML = DRAG_GRIP_SVG;
      this.setupDrag(grip, toolbar);
      toolbar.appendChild(grip);
      const selectBtn = document.createElement("vb-button");
      selectBtn.setAttribute("icon", "select");
      selectBtn.setAttribute("theme", "mode");
      selectBtn.setAttribute("data-tool", "select");
      selectBtn.textContent = "Select";
      selectBtn.title = "Select";
      selectBtn.addEventListener("click", () => this.emitToolChange("select"));
      this.selectBtnEl = selectBtn;
      const selectGroup = document.createElement("vb-button-group");
      selectGroup.appendChild(selectBtn);
      selectGroup.addEventListener("adjunct-click", (e) => {
        e.stopPropagation();
        this.emitAdjunctClick();
      });
      toolbar.appendChild(selectGroup);
      this.selectGroupEl = selectGroup;
      const sep = document.createElement("div");
      sep.className = "bt-sep";
      toolbar.appendChild(sep);
      const insertBtn = document.createElement("vb-button");
      insertBtn.setAttribute("icon", "insert");
      insertBtn.setAttribute("theme", "mode");
      insertBtn.setAttribute("data-tool", "insert");
      insertBtn.textContent = "Insert";
      insertBtn.title = "Insert";
      insertBtn.addEventListener("click", () => this.emitToolChange("insert"));
      toolbar.appendChild(insertBtn);
      this.insertBtnEl = insertBtn;
      this.appendChild(toolbar);
      this.toolbar = toolbar;
      this.updateButtonStates();
    }
    updateButtonStates() {
      if (!this.toolbar) return;
      const disabled = this.isDisabled;
      if (disabled) {
        this.selectBtnEl?.setAttribute("state", "disabled");
        this.insertBtnEl?.setAttribute("state", "disabled");
      }
      if (this.selectGroupEl) {
        this.selectGroupEl.setAttribute("count", String(this.instanceCount));
      }
    }
    /**
     * Apply per-tool visual states (picking/engaged/completed/dim).
     * Called by bottom-toolbar.ts to sync with the overlay state machine.
     */
    applyVisualStates(states) {
      if (!this.toolbar) return;
      const selectState = states["select"] ? STATE_MAP[states["select"]] || "default" : "default";
      const insertState = states["insert"] ? STATE_MAP[states["insert"]] || "default" : "default";
      this.selectBtnEl?.setAttribute("state", selectState);
      this.insertBtnEl?.setAttribute("state", insertState);
    }
    /** Add/remove text-editing class on toolbar (dims all buttons). */
    setTextEditingLock(locked) {
      if (!this.toolbar) return;
      if (locked) {
        this.toolbar.classList.add("text-editing");
      } else {
        this.toolbar.classList.remove("text-editing");
      }
    }
    emitToolChange(tool) {
      this.dispatchEvent(
        new CustomEvent("tool-change", {
          detail: { tool },
          bubbles: true,
          composed: true
        })
      );
    }
    emitAdjunctClick() {
      console.log("[vb-bottom-toolbar] emitAdjunctClick called");
      this.dispatchEvent(
        new CustomEvent("adjunct-click", {
          bubbles: true,
          composed: true
        })
      );
    }
    setupDrag(grip, toolbar) {
      let startX = 0;
      let startY = 0;
      let startLeft = 0;
      let startBottom = 0;
      let isDragging = false;
      const onMove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        toolbar.style.left = `${startLeft + dx}px`;
        toolbar.style.bottom = `${startBottom - dy}px`;
        toolbar.style.transform = "none";
      };
      const onUp = () => {
        isDragging = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      grip.addEventListener("mousedown", (e) => {
        e.preventDefault();
        isDragging = true;
        this.userDragged = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = toolbar.getBoundingClientRect();
        startLeft = rect.left;
        startBottom = window.innerHeight - rect.bottom;
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
    }
    centerToolbar() {
      if (!this.toolbar || this.userDragged) return;
      const wrapper = document.getElementById("tw-page-wrapper");
      let cx = window.innerWidth / 2;
      if (wrapper) {
        const rect = wrapper.getBoundingClientRect();
        cx = rect.left + rect.width / 2;
      }
      const w = this.toolbar.offsetWidth;
      this.toolbar.style.left = `${cx - w / 2}px`;
    }
  };
  if (!customElements.get("vb-bottom-toolbar")) {
    customElements.define("vb-bottom-toolbar", VbBottomToolbar);
  }

  // overlay/src/web-components/vb-element-drawer.ts
  var SpeechRecognitionAPI = typeof window !== "undefined" ? window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null : null;
  var VbElementDrawer = class extends HTMLElement {
    recognition = null;
    micBtn = null;
    textarea = null;
    usedVoice = false;
    static get observedAttributes() {
      return ["mode", "state"];
    }
    /* ── Attribute accessors ─────────────────────────────────────────── */
    get mode() {
      return this.getAttribute("mode") || "select";
    }
    set mode(v) {
      this.setAttribute("mode", v);
    }
    get state() {
      return this.getAttribute("state") || "menu";
    }
    set state(v) {
      this.setAttribute("state", v);
    }
    /* ── Lifecycle ───────────────────────────────────────────────────── */
    connectedCallback() {
      this.className = "element-drawer";
      this.render();
    }
    attributeChangedCallback(name, oldVal, newVal) {
      if (oldVal === newVal) return;
      this.render();
    }
    /* ── Rendering ───────────────────────────────────────────────────── */
    render() {
      this.innerHTML = "";
      this.recognition?.stop();
      this.recognition = null;
      this.micBtn = null;
      this.textarea = null;
      this.usedVoice = false;
      if (this.state === "describe") {
        this.renderDescribe();
      } else {
        this.renderMenu();
      }
    }
    /** State A — Two-button menu */
    renderMenu() {
      const pair = document.createElement("div");
      pair.className = "ed-btn-pair";
      const describeBtn = document.createElement("vb-button");
      describeBtn.setAttribute("icon", "describe");
      describeBtn.setAttribute("theme", "primary");
      describeBtn.setAttribute("class", "ed-action-btn");
      describeBtn.textContent = "Describe change";
      describeBtn.addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("describe-click", { bubbles: true }));
      });
      pair.appendChild(describeBtn);
      const textBtn = document.createElement("vb-button");
      textBtn.setAttribute("icon", "text");
      textBtn.setAttribute("theme", "primary");
      textBtn.setAttribute("class", "ed-action-btn");
      textBtn.textContent = this.mode === "insert" ? "Insert text" : "Edit text";
      textBtn.addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("text-click", { bubbles: true }));
      });
      pair.appendChild(textBtn);
      this.appendChild(pair);
    }
    /** State B — Describe change textarea form */
    renderDescribe() {
      const wrapper = document.createElement("div");
      wrapper.className = "ed-describe-wrapper";
      this.textarea = document.createElement("textarea");
      this.textarea.className = "ed-textarea";
      this.textarea.placeholder = "describe change";
      this.textarea.rows = 3;
      wrapper.appendChild(this.textarea);
      const controls = document.createElement("div");
      controls.className = "ed-controls-row";
      const backBtn = document.createElement("vb-button");
      backBtn.setAttribute("icon", "back");
      backBtn.setAttribute("size", "sm");
      backBtn.addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("back", { bubbles: true }));
      });
      controls.appendChild(backBtn);
      const rightGroup = document.createElement("div");
      rightGroup.className = "ed-controls-right";
      if (SpeechRecognitionAPI) {
        this.micBtn = document.createElement("vb-button");
        this.micBtn.setAttribute("icon", "mic");
        this.micBtn.setAttribute("size", "sm");
        this.micBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.toggleRecognition();
        });
        rightGroup.appendChild(this.micBtn);
      }
      const queueBtn = document.createElement("vb-button");
      queueBtn.setAttribute("theme", "danger");
      queueBtn.setAttribute("structure", "filled");
      queueBtn.setAttribute("size", "sm");
      queueBtn.setAttribute("class", "ed-queue-btn");
      queueBtn.textContent = "Queue";
      queueBtn.addEventListener("click", () => {
        const text = this.textarea?.value.trim() ?? "";
        if (!text) return;
        this.dispatchEvent(new CustomEvent("queue", {
          detail: { text, usedVoice: this.usedVoice },
          bubbles: true
        }));
      });
      rightGroup.appendChild(queueBtn);
      const commitBtn = document.createElement("vb-button");
      commitBtn.setAttribute("theme", "primary");
      commitBtn.setAttribute("structure", "filled");
      commitBtn.setAttribute("size", "sm");
      commitBtn.textContent = "Commit";
      commitBtn.addEventListener("click", () => {
        const text = this.textarea?.value.trim() ?? "";
        if (!text) return;
        this.dispatchEvent(new CustomEvent("commit", {
          detail: { text, usedVoice: this.usedVoice },
          bubbles: true
        }));
      });
      rightGroup.appendChild(commitBtn);
      controls.appendChild(rightGroup);
      wrapper.appendChild(controls);
      this.appendChild(wrapper);
      this.textarea.addEventListener("input", () => {
        this.textarea.style.height = "auto";
        this.textarea.style.height = this.textarea.scrollHeight + "px";
      });
      this.textarea.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          this.dispatchEvent(new CustomEvent("back", { bubbles: true }));
        }
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
          e.preventDefault();
          const text = this.textarea?.value.trim() ?? "";
          if (text) {
            this.dispatchEvent(new CustomEvent("commit", {
              detail: { text, usedVoice: this.usedVoice },
              bubbles: true
            }));
          }
        } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          const text = this.textarea?.value.trim() ?? "";
          if (text) {
            this.dispatchEvent(new CustomEvent("queue", {
              detail: { text, usedVoice: this.usedVoice },
              bubbles: true
            }));
          }
        }
      });
      requestAnimationFrame(() => this.textarea?.focus());
    }
    /* ── Voice recognition ───────────────────────────────────────────── */
    toggleRecognition() {
      if (this.recognition) {
        this.recognition.stop();
        return;
      }
      const baseText = this.textarea?.value ?? "";
      this.recognition = new SpeechRecognitionAPI();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = navigator.language || "en-US";
      this.recognition.onresult = (event) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        const sep = baseText && !baseText.endsWith("\n") ? "\n" : "";
        if (this.textarea) {
          this.textarea.value = baseText + sep + transcript;
          this.textarea.style.height = "auto";
          this.textarea.style.height = this.textarea.scrollHeight + "px";
        }
        this.usedVoice = true;
      };
      this.recognition.onend = () => {
        this.micBtn?.setAttribute("state", "default");
        this.recognition = null;
      };
      this.recognition.onerror = () => {
        this.micBtn?.setAttribute("state", "default");
        this.recognition = null;
      };
      this.micBtn?.setAttribute("state", "armed");
      this.recognition.start();
    }
  };
  customElements.define("vb-element-drawer", VbElementDrawer);

  // overlay/src/web-components/vb-message-input.ts
  var SpeechRecognitionAPI2 = typeof window !== "undefined" ? window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null : null;
  var VbMessageInput = class extends HTMLElement {
    textarea = null;
    micBtn = null;
    sendBtn = null;
    recognition = null;
    usedVoice = false;
    static get observedAttributes() {
      return ["placeholder", "show-send"];
    }
    /* ── Attribute accessors ─────────────────────────────────────────── */
    get placeholder() {
      return this.getAttribute("placeholder") ?? "add your message";
    }
    set placeholder(v) {
      this.setAttribute("placeholder", v);
    }
    get showSend() {
      return this.getAttribute("show-send") !== "false";
    }
    set showSend(v) {
      this.setAttribute("show-send", String(v));
    }
    /* ── Lifecycle ───────────────────────────────────────────────────── */
    connectedCallback() {
      this.className = "msg-row";
      if (!this.textarea) this.render();
    }
    attributeChangedCallback(name, oldVal, newVal) {
      if (oldVal === newVal || !this.textarea) return;
      if (name === "placeholder") {
        this.textarea.placeholder = newVal ?? "add your message";
      }
    }
    /* ── Public API ──────────────────────────────────────────────────── */
    /** Returns and clears the current textarea value. */
    getValue() {
      return this.textarea?.value.trim() ?? "";
    }
    /** Clears the textarea. */
    clear() {
      if (this.textarea) {
        this.textarea.value = "";
        this.textarea.style.height = "auto";
      }
      this.usedVoice = false;
    }
    /* ── Internals ───────────────────────────────────────────────────── */
    render() {
      this.textarea = document.createElement("textarea");
      this.textarea.rows = 1;
      this.textarea.placeholder = this.placeholder;
      this.appendChild(this.textarea);
      this.textarea.addEventListener("input", () => {
        this.textarea.style.height = "auto";
        this.textarea.style.height = this.textarea.scrollHeight + "px";
      });
      this.textarea.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.submit();
        }
        if (e.key === "Escape") {
          this.textarea?.blur();
        }
      });
      if (SpeechRecognitionAPI2) {
        this.micBtn = document.createElement("vb-button");
        this.micBtn.setAttribute("icon", "mic");
        this.micBtn.setAttribute("size", "sm");
        this.micBtn.title = "Record voice message";
        this.appendChild(this.micBtn);
        this.micBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.toggleRecognition();
        });
      }
      if (this.showSend) {
        this.sendBtn = document.createElement("vb-button");
        this.sendBtn.setAttribute("icon", "send");
        this.sendBtn.setAttribute("size", "sm");
        this.appendChild(this.sendBtn);
        this.sendBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.submit();
        });
      }
      this.addEventListener("click", (e) => e.stopPropagation());
    }
    submit() {
      const text = this.textarea?.value.trim() ?? "";
      if (!text) return;
      this.dispatchEvent(new CustomEvent("message-send", {
        detail: { text, usedVoice: this.usedVoice },
        bubbles: true
      }));
      this.clear();
    }
    toggleRecognition() {
      if (this.recognition) {
        this.recognition.stop();
        return;
      }
      const baseText = this.textarea?.value ?? "";
      this.recognition = new SpeechRecognitionAPI2();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = navigator.language || "en-US";
      this.recognition.onresult = (event) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        const sep = baseText && !baseText.endsWith("\n") ? "\n" : "";
        if (this.textarea) {
          this.textarea.value = baseText + sep + transcript;
          this.textarea.style.height = "auto";
          this.textarea.style.height = this.textarea.scrollHeight + "px";
        }
        this.usedVoice = true;
      };
      this.recognition.onend = () => {
        this.micBtn?.setAttribute("state", "default");
        this.recognition = null;
      };
      this.recognition.onerror = () => {
        this.micBtn?.setAttribute("state", "default");
        this.recognition = null;
      };
      this.micBtn?.setAttribute("state", "armed");
      this.recognition.start();
    }
  };
  customElements.define("vb-message-input", VbMessageInput);
})();
