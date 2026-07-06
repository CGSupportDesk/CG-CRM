"use client";

import { Edit3, Plus, Settings, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useCRM } from "@/components/crm-provider";
import { Badge, Button, EmptyState, FieldLabel, Modal, PageHeader, Panel, inputClasses } from "@/components/ui";
import { settingCategoryOptions } from "@/lib/constants";
import type { StudioSetting, StudioSettingCategory, StudioSettingDraft } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SettingsClient() {
  const {
    settings,
    loading,
    saving,
    addStudioSetting,
    updateStudioSetting,
    deleteStudioSetting,
  } = useCRM();
  const [category, setCategory] = useState<StudioSettingCategory>("Package");
  const [editingSetting, setEditingSetting] = useState<StudioSetting | null>(null);
  const [addingSetting, setAddingSetting] = useState(false);

  const settingsByCategory = useMemo(
    () =>
      settings.reduce<Record<string, StudioSetting[]>>((acc, setting) => {
        acc[setting.category] = [...(acc[setting.category] || []), setting];
        return acc;
      }, {}),
    [settings],
  );
  const categorySettings = settingsByCategory[category] || [];

  async function saveSetting(draft: StudioSettingDraft) {
    if (editingSetting) {
      await updateStudioSetting(editingSetting.id, draft);
      setEditingSetting(null);
    } else {
      await addStudioSetting(draft);
      setAddingSetting(false);
    }
  }

  function removeSetting(setting: StudioSetting) {
    if (window.confirm(`Delete ${setting.label}?`)) void deleteStudioSetting(setting.id);
  }

  if (loading) {
    return <EmptyState title="Loading settings" description="Preparing Growth Engine preferences." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage packages, industries, team members, statuses, lead sources, and project preferences used across CG Studio operations."
        action={
          <Button onClick={() => setAddingSetting(true)}>
            <Plus className="h-4 w-4" />
            Add Setting
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SettingsMetric label="Active Settings" value={settings.filter((setting) => setting.isActive).length} />
        <SettingsMetric label="Packages" value={(settingsByCategory.Package || []).length} />
        <SettingsMetric label="Team Members" value={(settingsByCategory["Team Member"] || []).length} />
        <SettingsMetric label="Lead Sources" value={(settingsByCategory["Lead Source"] || []).length} />
      </div>

      <Panel className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {settingCategoryOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setCategory(option)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-bold transition",
                category === option
                  ? "border-surface-strong bg-surface-strong text-white"
                  : "border-border bg-white text-muted hover:bg-surface-soft hover:text-foreground",
              )}
            >
              {option}
            </button>
          ))}
          {saving ? <Badge tone="info">Saving...</Badge> : null}
        </div>

        {categorySettings.length ? (
          <div className="overflow-hidden rounded-[20px] border border-border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-surface-strong text-xs font-bold uppercase tracking-[0.08em] text-[#cad6dc]">
                  <tr>
                    <th className="px-4 py-3">Label</th>
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3">Active</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
                  {categorySettings.map((setting) => (
                    <tr key={setting.id} className={!setting.isActive ? "opacity-60" : undefined}>
                      <td className="px-4 py-4 font-semibold">{setting.label}</td>
                      <td className="px-4 py-4">{setting.value || "-"}</td>
                      <td className="px-4 py-4 text-muted">{setting.notes || "-"}</td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => void updateStudioSetting(setting.id, { isActive: !setting.isActive })}
                        >
                          <Badge tone={setting.isActive ? "success" : "soon"}>{setting.isActive ? "Active" : "Inactive"}</Badge>
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => setEditingSetting(setting)} title="Edit setting">
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button variant="danger" size="icon" onClick={() => removeSetting(setting)} title="Delete setting">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            title={`No ${category.toLowerCase()} settings`}
            description="Add the first option for this category."
            action={<Button onClick={() => setAddingSetting(true)}>Add Setting</Button>}
          />
        )}
      </Panel>

      {addingSetting || editingSetting ? (
        <Modal
          title={editingSetting ? "Edit setting" : "Add setting"}
          description="These settings keep Growth Engine dropdowns and reports aligned with CG Studio operations."
          onClose={() => {
            setAddingSetting(false);
            setEditingSetting(null);
          }}
        >
          <SettingForm
            setting={editingSetting || undefined}
            defaultCategory={category}
            onSubmit={saveSetting}
            onCancel={() => {
              setAddingSetting(false);
              setEditingSetting(null);
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}

function SettingForm({
  setting,
  defaultCategory,
  onSubmit,
  onCancel,
}: {
  setting?: StudioSetting;
  defaultCategory: StudioSettingCategory;
  onSubmit: (draft: StudioSettingDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<StudioSettingDraft>(() => ({
    category: setting?.category || defaultCategory,
    label: setting?.label || "",
    value: setting?.value || "",
    isActive: setting?.isActive ?? true,
    notes: setting?.notes || "",
  }));

  function update<K extends keyof StudioSettingDraft>(key: K, value: StudioSettingDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(draft);
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <FieldLabel label="Category">
          <select className={inputClasses} value={draft.category} onChange={(event) => update("category", event.target.value as StudioSettingCategory)}>
            {settingCategoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </FieldLabel>
        <FieldLabel label="Label">
          <input className={inputClasses} value={draft.label} onChange={(event) => update("label", event.target.value)} required />
        </FieldLabel>
        <FieldLabel label="Value">
          <input className={inputClasses} value={draft.value} onChange={(event) => update("value", event.target.value)} placeholder="Optional" />
        </FieldLabel>
        <label className="flex items-center gap-2 self-end rounded-2xl border border-border bg-surface-soft px-3 py-3 text-sm font-semibold">
          <input type="checkbox" checked={draft.isActive} onChange={(event) => update("isActive", event.target.checked)} />
          Active
        </label>
      </div>
      <FieldLabel label="Notes">
        <textarea className={`${inputClasses} min-h-24 py-3`} value={draft.notes} onChange={(event) => update("notes", event.target.value)} />
      </FieldLabel>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save Setting</Button>
      </div>
    </form>
  );
}

function SettingsMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <Panel className="p-5">
      <Settings className="h-5 w-5 text-accent-dark" />
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-2 font-mono text-3xl font-bold tracking-tight">{value}</p>
    </Panel>
  );
}
