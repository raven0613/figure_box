import { Modal } from '~/components/common/Modal';
import type { TemplateAction } from './avatarEditorTypes';

interface AvatarEditorTemplateActionModalProps {
  action: TemplateAction;
  onCancel: () => void;
  onConfirm: () => void;
}

export function AvatarEditorTemplateActionModal({
  action,
  onCancel,
  onConfirm,
}: AvatarEditorTemplateActionModalProps) {
  return (
    <Modal
      options={{
        title: getTemplateActionTitle(action),
        content: getTemplateActionMessage(action),
        hasConfirmCancelButtons: true,
        closeOnBackdropClick: true,
        confirmLabel: getTemplateActionConfirmLabel(action),
        cancelLabel: '取消',
        onConfirm,
        onCancel,
      }}
      onClose={onCancel}
    />
  );
}

function getTemplateActionTitle(action: TemplateAction): string {
  if (action.type === 'reset') {
    return '重置外觀';
  }

  if (action.type === 'load') {
    return '套用模板';
  }

  if (action.type === 'overwrite') {
    return '覆蓋模板';
  }

  return '刪除模板';
}

function getTemplateActionMessage(action: TemplateAction): string {
  if (action.type === 'reset') {
    return '要把目前正在編輯的外觀全部重置為預設值嗎？';
  }

  if (action.type === 'load') {
    return `要用「${action.template.name}」覆蓋目前正在編輯的外觀嗎？`;
  }

  if (action.type === 'overwrite') {
    return `要用目前正在編輯的外觀覆蓋「${action.template.name}」嗎？`;
  }

  return `要刪除「${action.template.name}」嗎？`;
}

function getTemplateActionConfirmLabel(action: TemplateAction): string {
  if (action.type === 'reset') {
    return '重置';
  }

  if (action.type === 'load') {
    return '套用';
  }

  if (action.type === 'overwrite') {
    return '覆蓋';
  }

  return '刪除';
}
