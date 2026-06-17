import {
  ACCESSORY_CATEGORY_DEFINITIONS,
  AVATAR_EDITOR_PART_DEFINITIONS,
  type AccessoryCategory,
  type AccessoryLayerSlot,
  type AvatarAccessoryInstance,
  type AvatarPartDefinition,
  getAccessoryDisplayName,
  getAccessoryLayerSlotDefinition,
} from '~/widgets/avatarCanvas';
import type { AvatarAppearanceTemplateRecord } from '~/services/save/avatarAppearanceSaveService';
import type { DraftSaveStatus, SelectedTarget, TemplateAction } from './avatarEditorTypes';
import styles from './avatarEditor.module.scss';

interface AccessoriesBySlot {
  slot: {
    id: AccessoryLayerSlot;
    label: string;
  };
  accessories: AvatarAccessoryInstance[];
}

interface AvatarEditorSidebarProps {
  accessoriesBySlot: AccessoriesBySlot[];
  avatarTemplates: AvatarAppearanceTemplateRecord[];
  canUseNativeDrag: boolean;
  draftSaveStatus: DraftSaveStatus;
  selectedTarget: SelectedTarget;
  templateName: string;
  onAddAccessory: (category: AccessoryCategory) => void;
  onAccessoryDragEnd: () => void;
  onAccessoryDragStart: (instanceId: string) => void;
  onAccessoryDrop: (accessory: AvatarAccessoryInstance) => void;
  onRequestTemplateAction: (action: TemplateAction) => void;
  onSaveCurrentTemplate: () => void;
  onSelectAccessory: (instanceId: string) => void;
  onSelectPart: (partKey: AvatarPartDefinition['key']) => void;
  onTemplateNameChange: (templateName: string) => void;
}

export function AvatarEditorSidebar({
  accessoriesBySlot,
  avatarTemplates,
  canUseNativeDrag,
  draftSaveStatus,
  selectedTarget,
  templateName,
  onAddAccessory,
  onAccessoryDragEnd,
  onAccessoryDragStart,
  onAccessoryDrop,
  onRequestTemplateAction,
  onSaveCurrentTemplate,
  onSelectAccessory,
  onSelectPart,
  onTemplateNameChange,
}: AvatarEditorSidebarProps) {
  return (
    <aside className={styles.partMenu} aria-label="選擇部位">
      <div className={styles.panelTitle}>部位</div>
      <div className={styles.partList} role="radiogroup" aria-label="Avatar parts">
        {AVATAR_EDITOR_PART_DEFINITIONS.map(part => (
          <PartButton
            key={part.key}
            part={part}
            isSelected={selectedTarget.type === 'part' && part.key === selectedTarget.key}
            onSelect={() => onSelectPart(part.key)}
          />
        ))}
      </div>

      <div className={styles.accessoryToolbar} aria-label="新增配件">
        {ACCESSORY_CATEGORY_DEFINITIONS.map(category => (
          <button
            type="button"
            key={category.category}
            onClick={() => onAddAccessory(category.category)}
            disabled={category.options.length === 0}
            title={category.options.length === 0 ? '尚未放入素材' : `新增${category.label}`}
          >
            新增{category.label}
          </button>
        ))}
      </div>

      <div className={styles.accessoryList} aria-label="配件清單">
        {accessoriesBySlot.map(({ slot, accessories }) => (
          <div className={styles.accessorySlot} key={slot.id}>
            <div className={styles.accessorySlotTitle}>{slot.label}</div>
            {accessories.length === 0 ? (
              <div className={styles.emptySlot}>空</div>
            ) : accessories.map(accessory => (
              <AccessoryButton
                key={accessory.instanceId}
                accessory={accessory}
                canDrag={canUseNativeDrag}
                isSelected={selectedTarget.type === 'accessory' && selectedTarget.instanceId === accessory.instanceId}
                onDragEnd={onAccessoryDragEnd}
                onDragStart={() => onAccessoryDragStart(accessory.instanceId)}
                onDrop={() => onAccessoryDrop(accessory)}
                onSelect={() => onSelectAccessory(accessory.instanceId)}
              />
            ))}
          </div>
        ))}
      </div>

      <div className={styles.templatePanel} aria-label="外觀模板">
        <div className={styles.panelTitle}>模板</div>
        <input
          className={styles.templateNameInput}
          type="text"
          value={templateName}
          onChange={event => onTemplateNameChange(event.target.value)}
          placeholder="模板名稱"
        />
        <button
          className={styles.templateSaveButton}
          type="button"
          onClick={onSaveCurrentTemplate}
        >
          另存新模板
        </button>
        <button
          className={styles.resetAvatarButton}
          type="button"
          onClick={() => onRequestTemplateAction({ type: 'reset' })}
        >
          重置為預設值
        </button>
        <div className={styles.saveStatusLine}>{getDraftSaveStatusLabel(draftSaveStatus)}</div>
        <div className={styles.templateList}>
          {avatarTemplates.length === 0 ? (
            <div className={styles.emptySlot}>尚無模板</div>
          ) : avatarTemplates.map(template => (
            <div className={styles.templateItem} key={template.id}>
              <button
                className={styles.templateLoadButton}
                type="button"
                onClick={() => onRequestTemplateAction({ type: 'load', template })}
              >
                {template.name}
              </button>
              <button
                className={styles.templateOverwriteButton}
                type="button"
                onClick={() => onRequestTemplateAction({ type: 'overwrite', template })}
                aria-label={`覆蓋${template.name}`}
              >
                覆蓋
              </button>
              <button
                className={styles.templateDeleteButton}
                type="button"
                onClick={() => onRequestTemplateAction({ type: 'delete', template })}
                aria-label={`刪除${template.name}`}
              >
                刪除
              </button>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function PartButton({
  part,
  isSelected,
  onSelect,
}: {
  part: AvatarPartDefinition;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={isSelected ? styles.activePartButton : styles.partButton}
      type="button"
      onClick={onSelect}
      role="radio"
      aria-checked={isSelected}
    >
      <span>{part.label}</span>
      <span className={styles.zIndex}>z {part.zIndex}</span>
    </button>
  );
}

function AccessoryButton({
  accessory,
  canDrag,
  isSelected,
  onDragEnd,
  onDragStart,
  onDrop,
  onSelect,
}: {
  accessory: AvatarAccessoryInstance;
  canDrag: boolean;
  isSelected: boolean;
  onDragEnd: () => void;
  onDragStart: () => void;
  onDrop: () => void;
  onSelect: () => void;
}) {
  return (
    <button
      className={isSelected ? styles.activeAccessoryButton : styles.accessoryButton}
      type="button"
      draggable={canDrag}
      onClick={onSelect}
      onDragEnd={onDragEnd}
      onDragOver={event => {
        if (canDrag) {
          event.preventDefault();
        }
      }}
      onDragStart={event => {
        if (!canDrag) {
          event.preventDefault();
          return;
        }

        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', accessory.instanceId);
        onDragStart();
      }}
      onDrop={event => {
        if (!canDrag) {
          return;
        }

        event.preventDefault();
        onDrop();
      }}
    >
      <span>{getAccessoryDisplayName(accessory)}</span>
      <span className={styles.zIndex}>{getAccessoryLayerSlotDefinition(accessory.layerSlot).label}</span>
    </button>
  );
}

function getDraftSaveStatusLabel(status: DraftSaveStatus): string {
  if (status === 'pending') {
    return '草稿待儲存';
  }

  if (status === 'saved') {
    return '草稿已儲存';
  }

  if (status === 'error') {
    return '草稿儲存失敗';
  }

  return '草稿未變更';
}
