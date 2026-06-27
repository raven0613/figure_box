import { AvatarEditorContainer } from '~/components/avatarEditor/AvatarEditorContainer';
import styles from '~/App.module.scss';

export function AvatarEditorPage() {
  return (
    <div className={styles.avatarEditorPage}>
      <AvatarEditorContainer />
    </div>
  );
}
