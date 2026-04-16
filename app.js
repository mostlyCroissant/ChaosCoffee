(function () {
  const config = window.APP_CONFIG || {};
  const SHEETS_ENDPOINT = config.SHEETS_ENDPOINT || "";
  const STORAGE_KEY = config.STORAGE_KEY || "coffee-runner-cart-v1";
  const SELECTED_EVENT_KEY =
    config.SELECTED_EVENT_KEY || "coffee-runner-selected-event-v1";

  const modifierLibrary = [
    { key: "extra_shot", label: "Extra shot", jp: "エスプレッソショット追加" },
    { key: "oat_milk", label: "Oat milk", jp: "オーツミルク" },
    { key: "soy_milk", label: "Soy milk", jp: "ソイミルク" },
    { key: "almond_milk", label: "Almond milk", jp: "アーモンドミルク" },
    { key: "milk_on_side", label: "Milk on side", jp: "ミルクは別添え" },
    { key: "decaf", label: "Decaf", jp: "デカフェ" },
    { key: "cinnamon", label: "Cinnamon", jp: "シナモン少々" },
    { key: "no_foam", label: "No foam", jp: "フォームなし" },
    { key: "less_hot", label: "Less hot", jp: "熱さ控えめ" },
    { key: "extra_hot", label: "Extra hot", jp: "Sean" },
  ];

  const els = {
    banner: document.getElementById("statusBanner"),
    eventsView: document.getElementById("eventsView"),
    guestsView: document.getElementById("guestsView"),
    cartView: document.getElementById("cartView"),
    eventsList: document.getElementById("eventsList"),
    guestList: document.getElementById("guestList"),
    cartList: document.getElementById("cartList"),
    guestViewTitle: document.getElementById("guestViewTitle"),
    guestViewMeta: document.getElementById("guestViewMeta"),
    guestSearchInput: document.getElementById("guestSearchInput"),
    backToEventsBtn: document.getElementById("backToEventsBtn"),
    backToGuestsBtn: document.getElementById("backToGuestsBtn"),
    openCartBtn: document.getElementById("openCartBtn"),
    clearCartBtn: document.getElementById("clearCartBtn"),
    cartCountBadge: document.getElementById("cartCountBadge"),
    orderDialog: document.getElementById("orderDialog"),
    orderForm: document.getElementById("orderForm"),
    closeDialogBtn: document.getElementById("closeDialogBtn"),
    cancelOrderBtn: document.getElementById("cancelOrderBtn"),
    dialogGuestName: document.getElementById("dialogGuestName"),
    dialogGuestMeta: document.getElementById("dialogGuestMeta"),
    presetSelect: document.getElementById("presetSelect"),
    todayOrderInput: document.getElementById("todayOrderInput"),
    sizeSelect: document.getElementById("sizeSelect"),
    modifierChips: document.getElementById("modifierChips"),
    todayNoteInput: document.getElementById("todayNoteInput"),
    japanesePreview: document.getElementById("japanesePreview"),
    addGuestBtn: document.getElementById("addGuestBtn"),
    addGuestDialog: document.getElementById("addGuestDialog"),
    addGuestForm: document.getElementById("addGuestForm"),
    cancelAddGuestBtn: document.getElementById("cancelAddGuest"),
    newGuestNameInput: document.getElementById("newGuestName"),
    newGuestDrinkInput: document.getElementById("newGuestDrink"),
    starbucksPanel: document.getElementById("starbucksPanel"),
    toggleStarbucksPanel: document.getElementById("toggleStarbucksPanel"),
    starbucksPanelStatus: document.getElementById("starbucksPanelStatus"),
    starbucksRows: document.getElementById("starbucksRows"),
  };

  const state = {
    events: [],
    guests: [],
    starbucksMenu: [],
    selectedEventId: localStorage.getItem(SELECTED_EVENT_KEY) || null,
    cartByEvent: loadCart(),
    activeGuestId: null,
    selectedPresetIndex: 0,
    selectedModifiers: new Set(),
    starbucksOpen: false,
    starbucksSelections: {},
  };

  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function persistCart() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cartByEvent));
    updateCartCount();
  }

  function showBanner(message, isError = false) {
    if (!els.banner) return;
    els.banner.textContent = message;
    els.banner.classList.remove("hidden");
    els.banner.style.background = isError ? "#ffe8e3" : "#fff7d8";
    els.banner.style.borderColor = isError ? "#efb6a8" : "#e5d48c";
    els.banner.style.color = isError ? "#7d2217" : "#694f00";
  }

  function hideBanner() {
    els.banner?.classList.add("hidden");
  }

  function currentEvent() {
    return state.events.find((event) => event.event_id === state.selectedEventId) || null;
  }

  function guestsForSelectedEvent() {
    return state.guests.filter((guest) => {
      const eventIds = guest.event_ids_list || [];
      return eventIds.includes(state.selectedEventId);
    });
  }

  function cartForSelectedEvent() {
    return state.cartByEvent[state.selectedEventId] || [];
  }

  function saveSelectedEvent(eventId) {
    state.selectedEventId = eventId;
    localStorage.setItem(SELECTED_EVENT_KEY, eventId);
  }

  function normalizeRow(row) {
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key.trim().toLowerCase(),
        String(value ?? "").trim(),
      ])
    );
  }

  async function fetchSheetData() {
    if (!SHEETS_ENDPOINT) {
      showBanner("Add your Apps Script URL to config.js before using the app.", true);
      return;
    }

    try {
      hideBanner();

      const response = await fetch(SHEETS_ENDPOINT, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const payload = await response.json();

      state.events = (payload.events || []).map(normalizeRow);

      state.guests = (payload.guests || []).map((row) => {
        const guest = normalizeRow(row);
        guest.presets = parsePresets(guest.usual_orders_json);
        guest.event_ids_list = (guest.event_ids || guest.event_id || "")
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean);
        return guest;
      });

      state.starbucksMenu = (payload.starbucks_menu || [])
        .map(normalizeRow)
        .filter((item) => item.is_active === "TRUE" || item.is_active === "true")
        .map((item) => ({
          ...item,
          temps_list: (item.temps || "")
            .split("|")
            .map((value) => value.trim())
            .filter(Boolean),
          sizes_list: (item.sizes || "")
            .split("|")
            .map((value) => value.trim())
            .filter(Boolean),
        }))
        .sort((a, b) => Number(a.sort_order || 999) - Number(b.sort_order || 999));

      initializeStarbucksSelections();

      if (
        !state.selectedEventId ||
        !state.events.some((event) => event.event_id === state.selectedEventId)
      ) {
        const firstCurrentEvent =
          state.events.find((event) => event.is_current === "true") ||
          state.events[0] ||
          null;
        if (firstCurrentEvent) {
          saveSelectedEvent(firstCurrentEvent.event_id);
        }
      }

      renderAll();
      renderStarbucksQuickAdd();
    } catch (error) {
      console.error("fetchSheetData failed:", error);
      showBanner(
        "Could not load Google Sheets data. Check the Apps Script deployment and sheet access.",
        true
      );
    }
  }

  async function createGuestSimple(name, drink) {
    const response = await fetch(SHEETS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        action: "add_guest",
        guest_name: name,
        drink: drink,
        event_id: state.selectedEventId,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || `Request failed with ${response.status}`);
    }

    return data;
  }

  function parsePresets(raw) {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item, index) => ({
        id: item.id || `preset_${index + 1}`,
        label: item.label || `Preset ${index + 1}`,
        summary_en: item.summary_en || "",
        summary_jp: item.summary_jp || "",
      }));
    } catch {
      return [];
    }
  }

  function initializeStarbucksSelections() {
    const nextSelections = {};

    state.starbucksMenu.forEach((item) => {
      const existing = state.starbucksSelections[item.drink] || {};
      nextSelections[item.drink] = {
        temp:
          existing.temp && item.temps_list.includes(existing.temp)
            ? existing.temp
            : item.temps_list[0] || "",
        size:
          existing.size && item.sizes_list.includes(existing.size)
            ? existing.size
            : item.sizes_list[0] || "",
        qty: existing.qty && existing.qty > 0 ? existing.qty : 1,
      };
    });

    state.starbucksSelections = nextSelections;
  }

  function setStarbucksPanelOpen(isOpen) {
    state.starbucksOpen = isOpen;
    if (!els.starbucksPanel) return;

    els.starbucksPanel.classList.toggle("collapsed", !isOpen);
    if (els.starbucksPanelStatus) {
      els.starbucksPanelStatus.textContent = isOpen ? "Close" : "Open";
    }
  }

  function switchView(name) {
    [els.eventsView, els.guestsView, els.cartView].forEach((view) => {
      view?.classList.remove("active");
    });
    els[`${name}View`]?.classList.add("active");
  }

  function renderAll() {
    renderEvents();
    renderGuests();
    renderCart();
    updateCartCount();
  }

  function renderEvents() {
    if (!els.eventsList) return;

    const query = (els.guestSearchInput?.value || "").trim().toLowerCase();

    if (!state.events.length) {
      els.eventsList.innerHTML = `<div class="card empty-state">No events found yet.</div>`;
      return;
    }

    if (query) {
      const matchingGuests = state.guests
        .filter((guest) =>
          [guest.guest_name, guest.search_terms, guest.usual_order_label]
            .join(" ")
            .toLowerCase()
            .includes(query)
        )
        .sort((a, b) => (a.guest_name || "").localeCompare(b.guest_name || "", "ja"));

      if (!matchingGuests.length) {
        els.eventsList.innerHTML = `<div class="card empty-state">No guests match that search.</div>`;
        return;
      }

      const grouped = state.events
        .map((event) => {
          const guests = matchingGuests.filter((guest) => {
            const eventIds = guest.event_ids_list || [];
            return eventIds.includes(event.event_id);
          });
          return { event, guests };
        })
        .filter((group) => group.guests.length > 0);

      els.eventsList.innerHTML = grouped
        .map(
          ({ event, guests }) => `
          <section class="event-section">
            <h2 class="section-title">${escapeHtml(event.event_name || "Untitled event")}</h2>
            <div class="card-list">
              ${guests
                .map(
                  (guest) => `
                <article class="card guest-card search-result-card" data-event-id="${escapeHtml(
                  event.event_id
                )}" data-guest-id="${escapeHtml(guest.guest_id)}">
                  <div class="card-top">
                    <div>
                      <h3>${escapeHtml(guest.guest_name || "Unnamed guest")}</h3>
                      <p class="meta">${escapeHtml(event.location || "")}</p>
                    </div>
                    <span class="status-pill ${event.is_current === "true" ? "active" : ""}">
                      ${event.is_current === "true" ? "Current" : "Closed"}
                    </span>
                  </div>
                  <p class="order-summary"><strong>Usual:</strong> ${escapeHtml(
                    guest.usual_order_label || "No usual order saved"
                  )}</p>
                </article>
              `
                )
                .join("")}
            </div>
          </section>
        `
        )
        .join("");

      els.eventsList.querySelectorAll("[data-event-id]").forEach((card) => {
        card.addEventListener("click", () => {
          saveSelectedEvent(card.dataset.eventId);
          renderGuests();
          renderCart();
          renderStarbucksQuickAdd();
          switchView("guests");

          const guestId = card.dataset.guestId;
          if (guestId) {
            setTimeout(() => openOrderDialog(guestId), 0);
          }
        });
      });

      return;
    }

    const currentEvents = state.events.filter((event) => event.is_current === "true");
    const archivedEvents = state.events.filter((event) => event.is_current !== "true");

    function renderEventCard(event, statusLabel, isActive) {
      const guestCount = state.guests.filter((guest) => {
        const eventIds = guest.event_ids_list || [];
        return eventIds.includes(event.event_id);
      }).length;

      return `
        <article class="card event-card" data-event-id="${escapeHtml(event.event_id)}">
          <div class="card-top">
            <div>
              <h3>${escapeHtml(event.event_name || "Untitled event")}</h3>
            </div>
            <span class="status-pill ${isActive ? "active" : ""}">${statusLabel}</span>
          </div>
          <p class="subtle">${guestCount} guests</p>
        </article>
      `;
    }

    els.eventsList.innerHTML = `
      <section class="event-section">
        <h2 class="section-title">Current Events</h2>
        ${
          currentEvents.length
            ? currentEvents.map((event) => renderEventCard(event, "Current", true)).join("")
            : `<div class="card empty-state">No current events.</div>`
        }
      </section>

      <section class="event-section">
        <h2 class="section-title">Archived</h2>
        ${
          archivedEvents.length
            ? archivedEvents.map((event) => renderEventCard(event, "Closed", false)).join("")
            : `<div class="card empty-state">No archived events.</div>`
        }
      </section>
    `;

    els.eventsList.querySelectorAll("[data-event-id]").forEach((card) => {
      card.addEventListener("click", () => {
        saveSelectedEvent(card.dataset.eventId);
        renderGuests();
        renderCart();
        renderStarbucksQuickAdd();
        switchView("guests");
      });
    });
  }

  function renderGuests() {
    if (!els.guestList) return;

    const event = currentEvent();
    const filteredGuests = guestsForSelectedEvent().sort((a, b) =>
      (a.guest_name || "").localeCompare(b.guest_name || "", "ja")
    );

    if (els.guestViewTitle) {
      els.guestViewTitle.textContent = event?.event_name || "Guests";
    }
    if (els.guestViewMeta) {
      els.guestViewMeta.textContent = event ? `${event.location || ""}` : "Choose an event first.";
    }

    if (!event) {
      els.guestList.innerHTML = `<div class="card empty-state">Open an event to see its guest list.</div>`;
      return;
    }

    if (!filteredGuests.length) {
      els.guestList.innerHTML = `<div class="card empty-state">No guests in this event yet.</div>`;
      return;
    }

    const cart = cartForSelectedEvent();

    els.guestList.innerHTML = filteredGuests
      .map((guest) => {
        const cartItem = cart.find((item) => item.type === "guest" && item.guestId === guest.guest_id);
        const usualLabel =
          guest.presets[0]?.label || guest.usual_order_label || "No usual order saved";

        return `
          <article class="card guest-card" data-guest-id="${escapeHtml(guest.guest_id)}">
            <div class="card-top">
              <div>
                <h3>${escapeHtml(guest.guest_name || "Unnamed guest")}</h3>
              </div>
              <span class="status-pill ${cartItem?.collected ? "active" : ""}">
                ${cartItem ? (cartItem.collected ? "Collected" : "In cart") : "No order"}
              </span>
            </div>

            <div class="usual-row">
              <p class="order-summary"><strong>Usual:</strong> ${escapeHtml(usualLabel)}</p>
              <button
                type="button"
                class="primary-btn usual-add-btn"
                data-add-usual-id="${escapeHtml(guest.guest_id)}"
              >
                Add usual
              </button>
            </div>
          </article>
        `;
      })
      .join("");

    els.guestList.querySelectorAll("[data-guest-id]").forEach((card) => {
      card.addEventListener("click", () => openOrderDialog(card.dataset.guestId));
    });

    els.guestList.querySelectorAll("[data-add-usual-id]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        addUsualOrderToCart(button.dataset.addUsualId);
      });
    });
  }

  function renderCart() {
    if (!els.cartList) return;

    const cart = cartForSelectedEvent();
    if (!cart.length) {
      els.cartList.innerHTML = `<div class="card empty-state">No drinks in cart yet.</div>`;
      return;
    }

    els.cartList.innerHTML = cart
      .map((item, index) => {
        if (item.type === "starbucks") {
          return `
            <article class="card order-card ${item.collected ? "collected" : ""}">
              <label class="checkbox-row">
                <input type="checkbox" data-cart-index="${index}" ${item.collected ? "checked" : ""} />
                <div class="order-card-body">
                  <div class="order-row-top">
                    <div>
                      <h3>${escapeHtml(item.drink)}</h3>
                      <p class="grouped-order-meta">${escapeHtml(item.temperature)} · ${escapeHtml(item.size)} ×${escapeHtml(item.quantity)}</p>
                    </div>
                  </div>
                </div>
              </label>
            </article>
          `;
        }

        return `
          <article class="card order-card ${item.collected ? "collected" : ""}">
            <label class="checkbox-row">
              <input type="checkbox" data-cart-index="${index}" ${item.collected ? "checked" : ""} />
              <div class="order-card-body">
                <div class="order-row-top">
                  <div>
                    <h3>${escapeHtml(item.guestName)}</h3>
                  </div>
                </div>
                <p class="order-summary">${escapeHtml(item.orderSummaryEn)}</p>
                <div class="jp-order">${escapeHtml(item.orderSummaryJp)}</div>
              </div>
            </label>
          </article>
        `;
      })
      .join("");

    els.cartList.querySelectorAll("[data-cart-index]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const idx = Number(checkbox.dataset.cartIndex);
        const eventCart = cartForSelectedEvent();
        if (!eventCart[idx]) return;

        eventCart[idx].collected = checkbox.checked;
        persistCart();
        renderGuests();
        renderCart();
      });
    });
  }

  function renderStarbucksQuickAdd() {
    if (!els.starbucksRows) return;

    setStarbucksPanelOpen(state.starbucksOpen);

    if (!state.starbucksMenu.length) {
      els.starbucksRows.innerHTML = `<p class="subtle">No Starbucks menu items found.</p>`;
      return;
    }

    els.starbucksRows.innerHTML = state.starbucksMenu
      .map((item) => {
        const selection = state.starbucksSelections[item.drink] || {
          temp: item.temps_list[0] || "",
          size: item.sizes_list[0] || "",
          qty: 1,
        };

        return `
          <article class="starbucks-line">
            <h4 class="starbucks-line-name">${escapeHtml(item.drink)}</h4>

            <div class="starbucks-line-grid">
              <div class="starbucks-line-block">
                <p class="field-label">Temp</p>
                <div class="chips">
                  ${item.temps_list
                    .map(
                      (temp) => `
                      <button
                        type="button"
                        class="chip ${selection.temp === temp ? "selected" : ""}"
                        data-sbux-temp="${escapeHtml(item.drink)}"
                        data-sbux-temp-value="${escapeHtml(temp)}"
                      >
                        ${escapeHtml(temp)}
                      </button>
                    `
                    )
                    .join("")}
                </div>
              </div>

              <div class="starbucks-line-block">
                <p class="field-label">Size</p>
                <div class="chips">
                  ${item.sizes_list
                    .map(
                      (size) => `
                      <button
                        type="button"
                        class="chip ${selection.size === size ? "selected" : ""}"
                        data-sbux-size="${escapeHtml(item.drink)}"
                        data-sbux-size-value="${escapeHtml(size)}"
                      >
                        ${escapeHtml(size)}
                      </button>
                    `
                    )
                    .join("")}
                </div>
              </div>

              <div class="starbucks-line-block">
                <p class="field-label">Quantity</p>
                <div class="qty-row">
                  <button type="button" class="ghost-btn" data-sbux-minus="${escapeHtml(item.drink)}">−</button>
                  <div class="qty-value">${escapeHtml(selection.qty)}</div>
                  <button type="button" class="ghost-btn" data-sbux-plus="${escapeHtml(item.drink)}">+</button>
                </div>
              </div>

              <div class="starbucks-line-actions">
                <button
                  type="button"
                  class="primary-btn"
                  data-sbux-add="${escapeHtml(item.drink)}"
                >
                  Add
                </button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    els.starbucksRows.querySelectorAll("[data-sbux-temp]").forEach((button) => {
      button.addEventListener("click", () => {
        const drink = button.dataset.sbuxTemp;
        const value = button.dataset.sbuxTempValue;
        state.starbucksSelections[drink].temp = value;
        renderStarbucksQuickAdd();
      });
    });

    els.starbucksRows.querySelectorAll("[data-sbux-size]").forEach((button) => {
      button.addEventListener("click", () => {
        const drink = button.dataset.sbuxSize;
        const value = button.dataset.sbuxSizeValue;
        state.starbucksSelections[drink].size = value;
        renderStarbucksQuickAdd();
      });
    });

    els.starbucksRows.querySelectorAll("[data-sbux-minus]").forEach((button) => {
      button.addEventListener("click", () => {
        const drink = button.dataset.sbuxMinus;
        const current = state.starbucksSelections[drink].qty || 1;
        state.starbucksSelections[drink].qty = Math.max(1, current - 1);
        renderStarbucksQuickAdd();
      });
    });

    els.starbucksRows.querySelectorAll("[data-sbux-plus]").forEach((button) => {
      button.addEventListener("click", () => {
        const drink = button.dataset.sbuxPlus;
        const current = state.starbucksSelections[drink].qty || 1;
        state.starbucksSelections[drink].qty = current + 1;
        renderStarbucksQuickAdd();
      });
    });

    els.starbucksRows.querySelectorAll("[data-sbux-add]").forEach((button) => {
      button.addEventListener("click", () => {
        addStarbucksToCart(button.dataset.sbuxAdd);
      });
    });
  }

  function updateCartCount() {
    if (!els.cartCountBadge) return;
    els.cartCountBadge.textContent = String(cartForSelectedEvent().length);
  }

  function openOrderDialog(guestId) {
    const guest = state.guests.find((item) => item.guest_id === guestId);
    if (!guest || !els.orderDialog) return;

    state.activeGuestId = guestId;
    state.selectedPresetIndex = 0;
    state.selectedModifiers = new Set();

    if (els.dialogGuestName) els.dialogGuestName.textContent = guest.guest_name || "Guest";
    if (els.dialogGuestMeta) els.dialogGuestMeta.textContent = "";
    if (els.todayNoteInput) els.todayNoteInput.value = "";
    if (els.todayOrderInput) els.todayOrderInput.value = "";
    if (els.sizeSelect) els.sizeSelect.value = "";

    const presets = guest.presets.length
      ? guest.presets
      : [
          {
            id: "default",
            label: guest.usual_order_label || "Custom order",
            summary_en: guest.usual_order_summary_en || "",
            summary_jp: guest.usual_order_summary_jp || "",
          },
        ];

    if (els.presetSelect) {
      els.presetSelect.innerHTML = presets
        .map((preset, index) => {
          const label = preset.label || `Preset ${index + 1}`;
          const isUsual = index === 0 ? " 〔Usual〕" : "";
          return `<option value="${index}">${escapeHtml(label + isUsual)}</option>`;
        })
        .join("");
    }

    renderModifierChips();
    updateJapanesePreview();
    els.orderDialog.showModal();
  }

  function renderModifierChips() {
    if (!els.modifierChips) return;

    els.modifierChips.innerHTML = modifierLibrary
      .map(
        (modifier) => `
        <button type="button" class="chip ${state.selectedModifiers.has(modifier.key) ? "selected" : ""}" data-chip-key="${modifier.key}">
          ${escapeHtml(modifier.label)}
        </button>
      `
      )
      .join("");

    els.modifierChips.querySelectorAll("[data-chip-key]").forEach((chip) => {
      chip.addEventListener("click", () => {
        const key = chip.dataset.chipKey;
        if (state.selectedModifiers.has(key)) state.selectedModifiers.delete(key);
        else state.selectedModifiers.add(key);
        renderModifierChips();
        updateJapanesePreview();
      });
    });
  }

  function getActiveGuestAndPreset() {
    const guest = state.guests.find((item) => item.guest_id === state.activeGuestId);
    if (!guest) return { guest: null, preset: null };

    const presets = guest.presets.length
      ? guest.presets
      : [
          {
            id: "default",
            label: guest.usual_order_label || "Custom order",
            summary_en: guest.usual_order_summary_en || "",
            summary_jp: guest.usual_order_summary_jp || "",
          },
        ];

    const preset = presets[state.selectedPresetIndex] || presets[0];
    return { guest, preset };
  }

  function getSelectedSize() {
    return els.sizeSelect?.value || "";
  }

  function buildJapaneseSummary() {
    const { preset } = getActiveGuestAndPreset();
    const todayOrder = els.todayOrderInput?.value.trim() || "";
    const size = getSelectedSize();

    const baseOrder = todayOrder || preset?.summary_jp || "";
    const jpParts = [baseOrder].filter(Boolean);

    if (size) {
      jpParts.push(`${size}サイズ`);
    }

    [...state.selectedModifiers].forEach((key) => {
      const modifier = modifierLibrary.find((item) => item.key === key);
      if (modifier) jpParts.push(modifier.jp);
    });

    const note = els.todayNoteInput?.value.trim();
    if (note) jpParts.push(note);

    return jpParts.join("、") || "—";
  }

  function buildEnglishSummary() {
    const { preset } = getActiveGuestAndPreset();
    const todayOrder = els.todayOrderInput?.value.trim() || "";
    const size = getSelectedSize();

    const baseOrder = todayOrder || preset?.summary_en || preset?.label || "";
    if (!baseOrder) return "";

    const enParts = [baseOrder];

    if (size) {
      enParts.push(`Size: ${size}`);
    }

    [...state.selectedModifiers].forEach((key) => {
      const modifier = modifierLibrary.find((item) => item.key === key);
      if (modifier) enParts.push(modifier.label);
    });

    const note = els.todayNoteInput?.value.trim();
    if (note) enParts.push(`Note: ${note}`);

    return enParts.join(", ");
  }

  function updateJapanesePreview() {
    if (!els.japanesePreview) return;
    els.japanesePreview.textContent = buildJapaneseSummary();
  }

  function addUsualOrderToCart(guestId) {
    const guest = state.guests.find((item) => item.guest_id === guestId);
    if (!guest || !state.selectedEventId) return;

    const presets = guest.presets.length
      ? guest.presets
      : [
          {
            id: "default",
            label: guest.usual_order_label || "Custom order",
            summary_en: guest.usual_order_summary_en || guest.usual_order_label || "",
            summary_jp: guest.usual_order_summary_jp || "",
          },
        ];

    const preset = presets[0];

    const eventCart = state.cartByEvent[state.selectedEventId] || [];
    const newItem = {
      type: "guest",
      guestId: guest.guest_id,
      guestName: guest.guest_name,
      orderSummaryEn: preset.summary_en || preset.label || "",
      orderSummaryJp: preset.summary_jp || "—",
      collected: false,
      updatedAt: new Date().toISOString(),
    };

    const existingIndex = eventCart.findIndex(
      (item) => item.type === "guest" && item.guestId === guest.guest_id
    );

    if (existingIndex >= 0) {
      eventCart[existingIndex] = newItem;
    } else {
      eventCart.push(newItem);
    }

    state.cartByEvent[state.selectedEventId] = eventCart;
    persistCart();
    renderGuests();
    renderCart();
  }

  function addOrderToCart() {
    const { guest } = getActiveGuestAndPreset();
    if (!guest || !state.selectedEventId) return;

    const eventCart = state.cartByEvent[state.selectedEventId] || [];
    const newItem = {
      type: "guest",
      guestId: guest.guest_id,
      guestName: guest.guest_name,
      orderSummaryEn: buildEnglishSummary(),
      orderSummaryJp: buildJapaneseSummary(),
      collected: false,
      updatedAt: new Date().toISOString(),
    };

    const existingIndex = eventCart.findIndex(
      (item) => item.type === "guest" && item.guestId === guest.guest_id
    );

    if (existingIndex >= 0) {
      eventCart[existingIndex] = newItem;
    } else {
      eventCart.push(newItem);
    }

    state.cartByEvent[state.selectedEventId] = eventCart;
    persistCart();
    renderGuests();
    renderCart();
    els.orderDialog?.close();
    switchView("guests");
  }

  function addStarbucksToCart(drink) {
    if (!state.selectedEventId) return;

    const selection = state.starbucksSelections[drink];
    if (!selection || !selection.temp || !selection.size) {
      alert("Please select temperature and size.");
      return;
    }

    const eventCart = state.cartByEvent[state.selectedEventId] || [];

    const existingIndex = eventCart.findIndex(
      (item) =>
        item.type === "starbucks" &&
        item.drink === drink &&
        item.temperature === selection.temp &&
        item.size === selection.size
    );

    if (existingIndex >= 0) {
      eventCart[existingIndex].quantity += selection.qty;
      eventCart[existingIndex].collected = false;
      eventCart[existingIndex].updatedAt = new Date().toISOString();
    } else {
      eventCart.push({
        type: "starbucks",
        drink,
        temperature: selection.temp,
        size: selection.size,
        quantity: selection.qty,
        collected: false,
        updatedAt: new Date().toISOString(),
      });
    }

    state.cartByEvent[state.selectedEventId] = eventCart;
    persistCart();
    renderCart();

    setStarbucksPanelOpen(false);
    els.guestList?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function clearCart() {
    if (!state.selectedEventId) return;
    if (!window.confirm("Clear this event cart?")) return;

    state.cartByEvent[state.selectedEventId] = [];
    persistCart();
    renderGuests();
    renderCart();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  els.backToEventsBtn?.addEventListener("click", () => switchView("events"));
  els.backToGuestsBtn?.addEventListener("click", () => switchView("guests"));

  els.openCartBtn?.addEventListener("click", () => {
    renderCart();
    switchView("cart");
  });

  els.clearCartBtn?.addEventListener("click", clearCart);
  els.closeDialogBtn?.addEventListener("click", () => els.orderDialog?.close());
  els.cancelOrderBtn?.addEventListener("click", () => els.orderDialog?.close());

  els.guestSearchInput?.addEventListener("input", renderEvents);

  els.presetSelect?.addEventListener("change", (event) => {
    state.selectedPresetIndex = Number(event.target.value);
    updateJapanesePreview();
  });

  els.todayNoteInput?.addEventListener("input", updateJapanesePreview);
  els.todayOrderInput?.addEventListener("input", updateJapanesePreview);
  els.sizeSelect?.addEventListener("change", updateJapanesePreview);

  els.orderForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    addOrderToCart();
  });

  els.addGuestBtn?.addEventListener("click", () => {
    if (els.newGuestNameInput) els.newGuestNameInput.value = "";
    if (els.newGuestDrinkInput) els.newGuestDrinkInput.value = "";
    els.addGuestDialog?.showModal();
  });

  els.cancelAddGuestBtn?.addEventListener("click", () => {
    els.addGuestDialog?.close();
  });

  els.addGuestForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = els.newGuestNameInput?.value.trim() || "";
    const drink = els.newGuestDrinkInput?.value.trim() || "";

    if (!name || !drink) {
      alert("Please enter both name and drink.");
      return;
    }

    try {
      const result = await createGuestSimple(name, drink);
      await fetchSheetData();

      const newGuest = state.guests.find((g) => g.guest_id === result.guest_id);
      if (newGuest) {
        state.activeGuestId = newGuest.guest_id;
        state.selectedPresetIndex = 0;
        state.selectedModifiers = new Set();
        addOrderToCart();
      }

      els.addGuestDialog?.close();
    } catch (err) {
      console.error("Add guest flow failed:", err);
      alert(`Failed to add guest: ${err.message || err}`);
    }
  });

  els.toggleStarbucksPanel?.addEventListener("click", () => {
    setStarbucksPanelOpen(!state.starbucksOpen);
  });

  fetchSheetData();
})();