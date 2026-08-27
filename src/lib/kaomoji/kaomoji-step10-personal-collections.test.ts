import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectionCopyText,
  createCollection,
  deleteCollection,
  mergeImportedStore,
  removeItemFromCollection,
  renameCollection,
  saveItemToCollection,
  toggleFavorite,
} from "@/lib/kaomoji/personal/storage";
import {
  KAOMOJI_CANONICAL_ID_RE,
  sanitizeCollectionName,
  sanitizeKaomojiContent,
  sanitizePersonalLibraryStore,
  validateImportJson,
} from "@/lib/kaomoji/personal/sanitize";
import {
  MAX_ITEMS_PER_COLLECTION,
  MAX_PERSONAL_COLLECTIONS,
  MAX_TOTAL_PERSONAL_ITEMS,
} from "@/lib/kaomoji/personal/limits";
import type { PersonalLibraryStore, PersonalSavePayload } from "@/lib/kaomoji/personal/types";
import {
  DEFAULT_FAVORITES_COLLECTION_ID,
  PERSONAL_LIBRARY_VERSION,
} from "@/lib/kaomoji/personal/types";

function emptyStore(): PersonalLibraryStore {
  const now = new Date().toISOString();
  return {
    version: PERSONAL_LIBRARY_VERSION,
    items: {},
    collections: [
      {
        id: DEFAULT_FAVORITES_COLLECTION_ID,
        name: "Favorites",
        created_at: now,
        updated_at: now,
        item_ids: [],
        is_default: true,
      },
    ],
  };
}

const samplePayload: PersonalSavePayload = {
  id: "kao_00013e7cc777f411",
  content: "(◕‿◕)",
  slug: "kao-00013e7cc777f411",
  name: "Cute face",
  accessible_name: "Cute kaomoji face",
  source: "public",
};

describe("Step 10 — Personal kaomoji collections", () => {
  it("validates canonical kaomoji id format", () => {
    assert.ok(KAOMOJI_CANONICAL_ID_RE.test("kao_00013e7cc777f411"));
    assert.ok(!KAOMOJI_CANONICAL_ID_RE.test("kao-00013e7cc777f411"));
    assert.ok(!KAOMOJI_CANONICAL_ID_RE.test("<script>"));
  });

  it("sanitizes collection names and rejects control chars", () => {
    assert.equal(sanitizeCollectionName("  Cute  "), "Cute");
    assert.equal(sanitizeCollectionName("愛"), "愛");
    assert.equal(sanitizeCollectionName("\x00bad"), null);
    assert.equal(sanitizeCollectionName(""), null);
  });

  it("sanitizes kaomoji content with unicode", () => {
    assert.equal(sanitizeKaomojiContent("  (◕‿◕)  "), "(◕‿◕)");
    assert.equal(sanitizeKaomojiContent("한글"), "한글");
    assert.equal(sanitizeKaomojiContent(""), null);
  });

  it("creates default Favorites collection in empty store", () => {
    const store = emptyStore();
    assert.equal(store.collections.length, 1);
    assert.equal(store.collections[0]?.id, DEFAULT_FAVORITES_COLLECTION_ID);
    assert.equal(store.collections[0]?.is_default, true);
  });

  it("saves item to favorites idempotently", () => {
    let store = emptyStore();
    store = saveItemToCollection(store, DEFAULT_FAVORITES_COLLECTION_ID, samplePayload);
    assert.equal(store.collections[0]?.item_ids.length, 1);
    assert.equal(store.items[samplePayload.id]?.content, samplePayload.content);

    const again = saveItemToCollection(store, DEFAULT_FAVORITES_COLLECTION_ID, samplePayload);
    assert.equal(again.collections[0]?.item_ids.length, 1);
  });

  it("toggleFavorite adds then removes", () => {
    let store = emptyStore();
    store = toggleFavorite(store, samplePayload);
    assert.equal(store.collections[0]?.item_ids.includes(samplePayload.id), true);
    store = toggleFavorite(store, samplePayload);
    assert.equal(store.collections[0]?.item_ids.includes(samplePayload.id), false);
  });

  it("creates, renames, and deletes custom collections", () => {
    let store = emptyStore();
    const created = createCollection(store, "Gaming");
    assert.ok(created);
    assert.equal(created!.collections.length, 2);

    const customId = created!.collections[1]!.id;
    const renamed = renameCollection(created!, customId, "Work");
    assert.ok(renamed);
    assert.equal(renamed!.collections[1]?.name, "Work");

    assert.equal(renameCollection(renamed!, DEFAULT_FAVORITES_COLLECTION_ID, "Hack"), null);
    const deleted = deleteCollection(renamed!, customId);
    assert.ok(deleted);
    assert.equal(deleted!.collections.length, 1);
    assert.equal(deleteCollection(deleted!, DEFAULT_FAVORITES_COLLECTION_ID), null);
  });

  it("prevents duplicate items in one collection", () => {
    let store = saveItemToCollection(emptyStore(), DEFAULT_FAVORITES_COLLECTION_ID, samplePayload);
    store = saveItemToCollection(store, DEFAULT_FAVORITES_COLLECTION_ID, samplePayload);
    assert.equal(store.collections[0]?.item_ids.filter((id) => id === samplePayload.id).length, 1);
  });

  it("removes item from collection", () => {
    let store = saveItemToCollection(emptyStore(), DEFAULT_FAVORITES_COLLECTION_ID, samplePayload);
    store = removeItemFromCollection(store, DEFAULT_FAVORITES_COLLECTION_ID, samplePayload.id);
    assert.equal(store.collections[0]?.item_ids.length, 0);
  });

  it("collectionCopyText returns one kaomoji per line without metadata", () => {
    let store = emptyStore();
    store = saveItemToCollection(store, DEFAULT_FAVORITES_COLLECTION_ID, samplePayload);
    store = saveItemToCollection(store, DEFAULT_FAVORITES_COLLECTION_ID, {
      ...samplePayload,
      id: "kao_000c332b7e7b5b52",
      content: "(^_^)",
    });
    const text = collectionCopyText(store, DEFAULT_FAVORITES_COLLECTION_ID);
    assert.equal(text, "(^_^)\n(◕‿◕)");
    assert.ok(!text.includes("http"));
    assert.ok(!text.includes("<"));
  });

  it("rejects malicious import JSON", () => {
    const bad = validateImportJson('{"version":99,"items":{},"collections":[]}');
    assert.equal(bad.ok, false);
    const xss = validateImportJson(
      JSON.stringify({
        version: 1,
        items: {
          "kao_00013e7cc777f411": {
            id: "kao_00013e7cc777f411",
            content: "<script>alert(1)</script>",
            accessible_name: "x",
            saved_at: "2026-01-01",
          },
        },
        collections: [],
      }),
    );
    assert.equal(xss.ok, true);
    if (xss.ok) {
      assert.equal(xss.store.items["kao_00013e7cc777f411"]?.content, "<script>alert(1)</script>");
    }
  });

  it("sanitizes corrupted localStorage shape gracefully", () => {
    assert.equal(sanitizePersonalLibraryStore(null), null);
    assert.equal(sanitizePersonalLibraryStore({ version: 2 }), null);
    const ok = sanitizePersonalLibraryStore(emptyStore());
    assert.ok(ok);
  });

  it("enforces collection count limit", () => {
    let store = emptyStore();
    for (let i = 0; i < MAX_PERSONAL_COLLECTIONS; i++) {
      const next = createCollection(store, `Col ${i}`);
      if (!next) break;
      store = next;
    }
    assert.equal(store.collections.length, MAX_PERSONAL_COLLECTIONS);
    assert.equal(createCollection(store, "Overflow"), null);
  });

  it("mergeImportedStore respects total item cap", () => {
    const current = emptyStore();
    const items: PersonalLibraryStore["items"] = {};
    for (let i = 0; i < MAX_TOTAL_PERSONAL_ITEMS + 5; i++) {
      const id = `kao_${i.toString(16).padStart(16, "0")}`;
      items[id] = {
        id,
        content: `( ${i} )`,
        slug: null,
        name: null,
        accessible_name: `Item ${i}`,
        source: "public",
        saved_at: new Date().toISOString(),
      };
    }
    const incoming = sanitizePersonalLibraryStore({
      version: 1,
      items,
      collections: [],
    })!;
    const merged = mergeImportedStore(current, incoming);
    assert.ok(Object.keys(merged.items).length <= MAX_TOTAL_PERSONAL_ITEMS);
  });

  it("supports multilingual collection names", () => {
    const names = ["My Favorites", "かわいい", "사랑", "可爱", "प्यार", "Amour", "Glück"];
    for (const name of names) {
      const store = createCollection(emptyStore(), name);
      assert.ok(store, name);
      assert.equal(store!.collections[1]?.name, name);
    }
  });

  it("blocks invalid item ids from being stored via sanitize", () => {
    const raw = {
      version: 1,
      items: {
        blocked_slug: {
          id: "blocked_slug",
          content: "(x)",
          accessible_name: "x",
          saved_at: "2026-01-01",
        },
        [samplePayload.id]: {
          id: samplePayload.id,
          content: samplePayload.content,
          accessible_name: samplePayload.accessible_name,
          saved_at: "2026-01-01",
        },
      },
      collections: [
        {
          id: DEFAULT_FAVORITES_COLLECTION_ID,
          name: "Favorites",
          created_at: "2026-01-01",
          updated_at: "2026-01-01",
          item_ids: ["blocked_slug", samplePayload.id],
          is_default: true,
        },
      ],
    };
    const store = sanitizePersonalLibraryStore(raw);
    assert.ok(store);
    assert.equal(Object.keys(store!.items).length, 1);
    assert.equal(store!.collections[0]?.item_ids.length, 1);
    assert.equal(store!.collections[0]?.item_ids[0], samplePayload.id);
  });

  it("respects max items per collection", () => {
    let store = emptyStore();
    for (let i = 0; i < MAX_ITEMS_PER_COLLECTION + 3; i++) {
      const id = `kao_${i.toString(16).padStart(16, "0")}`;
      store = saveItemToCollection(store, DEFAULT_FAVORITES_COLLECTION_ID, {
        id,
        content: `(${i})`,
        accessible_name: `Item ${i}`,
        source: "public",
      });
    }
    assert.equal(store.collections[0]?.item_ids.length, MAX_ITEMS_PER_COLLECTION);
  });
});
