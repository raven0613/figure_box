import { useRef, useState } from 'react';
import { DraggablePanel } from '~/components/common/DraggablePanel';
import { CHARACTER_SEEDS } from '~/constants/character';
import {
  evaluateRomanceRuleAccess,
  getRomanceProfile,
  type CharacterGender,
  type CharacterRomanceProfile,
  type GlobalRomanceDefault,
  type RomanceRule,
  type RomanceRuleAccessResult,
  type RomanceRuleEndpoint,
  type RomanceRuleType,
  type RomanticOrientation,
} from '~/services/romanceRules/romanceRuleService';
import styles from './settingsPanel.module.scss';

type SettingsTab = 'general' | 'romanceRules';

interface SettingsPanelProps extends RomanceRulesPanelProps {
  onClose: () => void;
}

const PANEL_WIDTH_PX = 460;
const PANEL_TOP_PX = 76;
const PANEL_MARGIN_PX = 18;
const ALL_ENDPOINT_VALUE = 'all';

const SETTINGS_TABS: readonly {
  id: SettingsTab;
  label: string;
}[] = [
  { id: 'general', label: '一般設定' },
  { id: 'romanceRules', label: '戀愛規則' },
];

const ROMANCE_RULE_TYPES: readonly {
  value: RomanceRuleType;
  label: string;
}[] = [
  { value: 'allow', label: '允許' },
  { value: 'deny', label: '禁止' },
  { value: 'onlyAllow', label: '只允許' },
];

const CHARACTER_GENDER_OPTIONS: readonly {
  value: CharacterGender;
  label: string;
}[] = [
  { value: 'male', label: '男性' },
  { value: 'female', label: '女性' },
  { value: 'nonBinary', label: '非二元' },
];

const ROMANTIC_ORIENTATION_OPTIONS: readonly {
  value: RomanticOrientation;
  label: string;
}[] = [
  { value: 'any', label: '任何性別' },
  { value: 'male', label: '男性' },
  { value: 'female', label: '女性' },
  { value: 'nonBinary', label: '非二元' },
  { value: 'none', label: '不產生戀愛情感' },
];

const CHARACTER_OPTIONS = CHARACTER_SEEDS.map(character => ({
  id: character.id,
  name: character.name,
}));

export function SettingsPanel({
  globalRomanceDefault,
  romanceProfilesByCharacterId,
  romanceRules,
  onClose,
  onGlobalRomanceDefaultChange,
  onRomanceProfilesChange,
  onRomanceRulesChange,
}: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [initialPosition] = useState(() => getInitialPanelPosition());

  return (
    <DraggablePanel
      title="設定"
      initialPosition={initialPosition}
      closeAriaLabel="關閉設定"
      className={styles.panel}
      contentClassName={styles.content}
      onClose={onClose}
    >
      <div className={styles.tabs} role="tablist" aria-label="設定分類">
        {SETTINGS_TABS.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tabButton} ${activeTab === tab.id ? styles.activeTabButton : ''}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section className={styles.tabPanel} role="tabpanel">
        {activeTab === 'general' ? (
          <p className={styles.emptyState}>尚無一般設定。</p>
        ) : (
          <RomanceRulesPanel
            globalRomanceDefault={globalRomanceDefault}
            romanceProfilesByCharacterId={romanceProfilesByCharacterId}
            romanceRules={romanceRules}
            onGlobalRomanceDefaultChange={onGlobalRomanceDefaultChange}
            onRomanceProfilesChange={onRomanceProfilesChange}
            onRomanceRulesChange={onRomanceRulesChange}
          />
        )}
      </section>
    </DraggablePanel>
  );
}

interface RomanceRulesPanelProps {
  globalRomanceDefault: GlobalRomanceDefault;
  romanceProfilesByCharacterId: Record<string, CharacterRomanceProfile>;
  romanceRules: RomanceRule[];
  onGlobalRomanceDefaultChange: (globalDefault: GlobalRomanceDefault) => void;
  onRomanceProfilesChange: (profilesByCharacterId: Record<string, CharacterRomanceProfile>) => void;
  onRomanceRulesChange: (rules: RomanceRule[]) => void;
}

function RomanceRulesPanel({
  globalRomanceDefault,
  romanceProfilesByCharacterId,
  romanceRules,
  onGlobalRomanceDefaultChange,
  onRomanceProfilesChange,
  onRomanceRulesChange,
}: RomanceRulesPanelProps) {
  const nextRuleIdRef = useRef(1);
  const [draftRuleType, setDraftRuleType] = useState<RomanceRuleType>('allow');
  const [draftSourceValue, setDraftSourceValue] = useState(ALL_ENDPOINT_VALUE);
  const [draftTargetValue, setDraftTargetValue] = useState<string>(CHARACTER_OPTIONS[0]?.id ?? ALL_ENDPOINT_VALUE);
  const [selectedProfileCharacterId, setSelectedProfileCharacterId] = useState<string>(CHARACTER_OPTIONS[0]?.id ?? '');
  const [previewSourceId, setPreviewSourceId] = useState<string>(CHARACTER_OPTIONS[0]?.id ?? '');
  const [previewTargetId, setPreviewTargetId] = useState<string>(CHARACTER_OPTIONS[1]?.id ?? CHARACTER_OPTIONS[0]?.id ?? '');
  const allowRules = romanceRules.filter(rule => rule.type === 'allow');
  const denyRules = romanceRules.filter(rule => rule.type === 'deny');
  const onlyAllowRules = romanceRules.filter(rule => rule.type === 'onlyAllow');
  const selectedRomanceProfile = getRomanceProfile(romanceProfilesByCharacterId, selectedProfileCharacterId);
  const previewResult = evaluateRomanceRuleAccess({
    sourceId: previewSourceId,
    targetId: previewTargetId,
    config: {
      globalDefault: globalRomanceDefault,
      profilesByCharacterId: romanceProfilesByCharacterId,
      rules: romanceRules,
    },
  });

  const addRomanceRule = () => {
    const nextRule: RomanceRule = {
      id: `romance-rule-${nextRuleIdRef.current}`,
      type: draftRuleType,
      source: parseEndpointValue(draftSourceValue),
      target: parseEndpointValue(draftTargetValue),
    };

    nextRuleIdRef.current += 1;
    onRomanceRulesChange([...romanceRules, nextRule]);
  };

  const deleteRomanceRule = (ruleId: string) => {
    onRomanceRulesChange(romanceRules.filter(rule => rule.id !== ruleId));
  };

  const updateSelectedRomanceProfile = (partialProfile: Partial<CharacterRomanceProfile>) => {
    if (!selectedProfileCharacterId) {
      return;
    }

    onRomanceProfilesChange({
      ...romanceProfilesByCharacterId,
      [selectedProfileCharacterId]: {
        ...selectedRomanceProfile,
        ...partialProfile,
      },
    });
  };

  return (
    <div className={styles.romanceRulesPanel}>
      <div className={`${styles.ruleLayer} ${styles.orientationLayer}`}>
        <div>
          <span className={styles.layerRank}>第 0 層</span>
          <h3>性向</h3>
          <p className={styles.ruleEmptyText}>性向是硬性前置條件，任何規則都不能突破。</p>
          <div className={styles.orientationEditor}>
            <label>
              角色
              <select
                value={selectedProfileCharacterId}
                onChange={event => setSelectedProfileCharacterId(event.target.value)}
              >
                <CharacterOptions />
              </select>
            </label>
            <label>
              性別
              <select
                value={selectedRomanceProfile.gender}
                onChange={event => updateSelectedRomanceProfile({ gender: event.target.value as CharacterGender })}
              >
                {CHARACTER_GENDER_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              性向
              <select
                value={selectedRomanceProfile.orientation}
                onChange={event => updateSelectedRomanceProfile({ orientation: event.target.value as RomanticOrientation })}
              >
                {ROMANTIC_ORIENTATION_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <span className={styles.layerBadge}>不可覆蓋</span>
      </div>

      <div className={`${styles.ruleLayer} ${styles.globalLayer}`}>
        <div>
          <span className={styles.layerRank}>第 1 層</span>
          <h3>全域預設</h3>
        </div>
        <div className={styles.segmentedControl} aria-label="全域戀愛情感預設">
          <button
            className={`${styles.segmentButton} ${globalRomanceDefault === 'allow' ? styles.activeSegmentButton : ''}`}
            type="button"
            aria-pressed={globalRomanceDefault === 'allow'}
            onClick={() => onGlobalRomanceDefaultChange('allow')}
          >
            預設允許
          </button>
          <button
            className={`${styles.segmentButton} ${globalRomanceDefault === 'deny' ? styles.activeSegmentButton : ''}`}
            type="button"
            aria-pressed={globalRomanceDefault === 'deny'}
            onClick={() => onGlobalRomanceDefaultChange('deny')}
          >
            預設禁止
          </button>
        </div>
      </div>

      <div className={styles.ruleComposer}>
        <label>
          規則
          <select
            value={draftRuleType}
            onChange={event => setDraftRuleType(event.target.value as RomanceRuleType)}
          >
            {ROMANCE_RULE_TYPES.map(ruleType => (
              <option key={ruleType.value} value={ruleType.value}>
                {ruleType.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          誰
          <select
            value={draftSourceValue}
            onChange={event => setDraftSourceValue(event.target.value)}
          >
            <EndpointOptions />
          </select>
        </label>
        <label>
          對誰
          <select
            value={draftTargetValue}
            onChange={event => setDraftTargetValue(event.target.value)}
          >
            <EndpointOptions />
          </select>
        </label>
        <button
          className={styles.addRuleButton}
          type="button"
          onClick={addRomanceRule}
        >
          新增規則
        </button>
      </div>

      <RuleGroup
        rank="第 2 層"
        title="允許規則"
        badge="可開放"
        className={styles.allowLayer}
        emptyText="尚無允許規則。"
        rules={allowRules}
        onDeleteRule={deleteRomanceRule}
      />
      <RuleGroup
        rank="第 3 層"
        title="禁止規則"
        badge="覆蓋允許"
        className={styles.denyLayer}
        emptyText="尚無禁止規則。"
        rules={denyRules}
        onDeleteRule={deleteRomanceRule}
      />
      <RuleGroup
        rank="第 4 層"
        title="只允許規則"
        badge="最高規則"
        className={styles.onlyAllowLayer}
        emptyText="尚無只允許規則。"
        rules={onlyAllowRules}
        onDeleteRule={deleteRomanceRule}
      />

      <RomanceRulePreview
        sourceId={previewSourceId}
        targetId={previewTargetId}
        result={previewResult}
        globalRomanceDefault={globalRomanceDefault}
        onSourceChange={setPreviewSourceId}
        onTargetChange={setPreviewTargetId}
      />

      <div className={styles.prioritySummary}>
        性向 &gt; 只允許 &gt; 禁止 &gt; 允許 &gt; 全域預設
      </div>
    </div>
  );
}

interface RomanceRulePreviewProps {
  sourceId: string;
  targetId: string;
  result: RomanceRuleAccessResult;
  globalRomanceDefault: GlobalRomanceDefault;
  onSourceChange: (characterId: string) => void;
  onTargetChange: (characterId: string) => void;
}

function RomanceRulePreview({
  sourceId,
  targetId,
  result,
  globalRomanceDefault,
  onSourceChange,
  onTargetChange,
}: RomanceRulePreviewProps) {
  return (
    <div className={styles.rulePreview}>
      <div className={styles.rulePreviewHeader}>
        <div>
          <span className={styles.layerRank}>預覽</span>
          <h3>檢查戀愛方向</h3>
        </div>
        <span className={styles.layerBadge}>規則預覽</span>
      </div>

      <div className={styles.previewControls}>
        <label>
          誰
          <select
            value={sourceId}
            onChange={event => onSourceChange(event.target.value)}
          >
            <CharacterOptions />
          </select>
        </label>
        <label>
          會不會愛上誰
          <select
            value={targetId}
            onChange={event => onTargetChange(event.target.value)}
          >
            <CharacterOptions />
          </select>
        </label>
      </div>

      <div className={`${styles.previewResult} ${result.isAllowed ? styles.allowedPreviewResult : styles.deniedPreviewResult}`}>
        <strong>{result.isAllowed ? '結果：允許' : '結果：禁止'}</strong>
        <span>{formatPreviewReason(result, sourceId, targetId, globalRomanceDefault)}</span>
        {result.matchedRule ? (
          <span>命中規則：{formatRomanceRule(result.matchedRule)}</span>
        ) : null}
        <small>預覽會先檢查性向；性向不符合時，任何規則都不會開放戀愛情感。</small>
      </div>
    </div>
  );
}

function EndpointOptions() {
  return (
    <>
      <option value={ALL_ENDPOINT_VALUE}>所有角色</option>
      <CharacterOptions />
    </>
  );
}

function CharacterOptions() {
  return (
    <>
      {CHARACTER_OPTIONS.map(character => (
        <option key={character.id} value={character.id}>
          {character.name}
        </option>
      ))}
    </>
  );
}

interface RuleGroupProps {
  rank: string;
  title: string;
  badge: string;
  className: string;
  emptyText: string;
  rules: RomanceRule[];
  onDeleteRule: (ruleId: string) => void;
}

function RuleGroup({
  rank,
  title,
  badge,
  className,
  emptyText,
  rules,
  onDeleteRule,
}: RuleGroupProps) {
  return (
    <div className={`${styles.ruleLayer} ${className}`}>
      <div>
        <span className={styles.layerRank}>{rank}</span>
        <h3>{title}</h3>
        {rules.length > 0 ? (
          <ul className={styles.ruleList}>
            {rules.map(rule => (
              <li key={rule.id} className={styles.ruleItem}>
                <span>{formatRomanceRule(rule)}</span>
                <button
                  className={styles.deleteRuleButton}
                  type="button"
                  aria-label={`刪除${formatRomanceRule(rule)}`}
                  onClick={() => onDeleteRule(rule.id)}
                >
                  刪除
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.ruleEmptyText}>{emptyText}</p>
        )}
      </div>
      <span className={styles.layerBadge}>{badge}</span>
    </div>
  );
}

function parseEndpointValue(value: string): RomanceRuleEndpoint {
  return value === ALL_ENDPOINT_VALUE
    ? { type: 'all' }
    : { type: 'character', characterId: value };
}

function formatPreviewReason(
  result: RomanceRuleAccessResult,
  sourceId: string,
  targetId: string,
  globalRomanceDefault: GlobalRomanceDefault,
): string {
  switch (result.reason) {
    case 'missingCharacter':
      return '沒有可檢查的角色。';
    case 'orientationMismatch':
      return `${formatCharacterName(targetId)} 不符合 ${formatCharacterName(sourceId)} 的性向。`;
    case 'onlyAllowMatched':
      return `${formatCharacterName(sourceId)} 的只允許規則包含 ${formatCharacterName(targetId)}。`;
    case 'onlyAllowBlocked':
      return `${formatCharacterName(sourceId)} 有只允許規則，未包含 ${formatCharacterName(targetId)}。`;
    case 'denyMatched':
      return '禁止規則覆蓋允許規則與全域預設。';
    case 'allowMatched':
      return '允許規則覆蓋全域預設。';
    case 'globalDefault':
      return globalRomanceDefault === 'allow'
        ? '沒有命中更高層規則，使用全域預設允許。'
        : '沒有命中更高層規則，使用全域預設禁止。';
    default:
      return '';
  }
}

function formatRomanceRule(rule: RomanceRule): string {
  switch (rule.type) {
    case 'allow':
      return formatAllowRule(rule);
    case 'deny':
      return `禁止：${formatEndpointName(rule.source)} -> ${formatEndpointName(rule.target)}`;
    case 'onlyAllow':
      return `限定：${formatEndpointName(rule.source)} 只允許 -> ${formatEndpointName(rule.target)}`;
    default:
      return '';
  }
}

function formatAllowRule(rule: RomanceRule): string {
  if (rule.source.type === 'all' && rule.target.type === 'all') {
    return '開放：所有性向相符的配對';
  }

  if (rule.source.type === 'all') {
    return `開放：所有性向相符的角色 -> ${formatEndpointName(rule.target)}`;
  }

  if (rule.target.type === 'all') {
    return `開放：${formatEndpointName(rule.source)} -> 所有符合 ${formatEndpointName(rule.source)} 性向的角色`;
  }

  return `開放：${formatEndpointName(rule.source)} -> ${formatEndpointName(rule.target)}`;
}

function formatEndpointName(endpoint: RomanceRuleEndpoint): string {
  if (endpoint.type === 'all') {
    return '所有角色';
  }

  return formatCharacterName(endpoint.characterId);
}

function formatCharacterName(characterId: string): string {
  return CHARACTER_OPTIONS.find(character => character.id === characterId)?.name ?? '未知角色';
}

function getInitialPanelPosition() {
  if (typeof window === 'undefined') {
    return {
      left: PANEL_MARGIN_PX,
      top: PANEL_TOP_PX,
    };
  }

  return {
    left: Math.max(PANEL_MARGIN_PX, window.innerWidth - PANEL_WIDTH_PX - PANEL_MARGIN_PX),
    top: PANEL_TOP_PX,
  };
}
