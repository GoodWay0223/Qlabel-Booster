import { Button, Tooltip } from 'tdesign-react';
import { AddIcon, DeleteIcon, SettingIcon, ImageIcon, VideoIcon, ChatIcon, ServerIcon } from 'tdesign-icons-react';
import { Bot } from 'lucide-react';
import { APP_CONFIG } from '../config';
import { Session, Agent } from '../types';
import { ICON_MAP } from '../utils/iconMap';

export type SidebarRoute = 'agent' | 'playground' | 'image' | 'video' | 'providers' | 'settings';

interface SidebarProps {
  sessions: Session[];
  currentSessionId: string | null;
  activeRoute: SidebarRoute;
  sidebarOpen: boolean;
  agents: Agent[];
  getAgent: (id: string) => Agent | undefined;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onNavigate: (route: SidebarRoute) => void;
}

const NAV_ITEMS: { key: SidebarRoute; label: string; icon: React.ReactNode }[] = [
  { key: 'agent', label: 'Agent 对话', icon: <Bot size={16} /> },
  { key: 'playground', label: 'LLM Playground', icon: <ChatIcon /> },
  { key: 'image', label: '文生图', icon: <ImageIcon /> },
  { key: 'video', label: '文生视频', icon: <VideoIcon /> },
  { key: 'providers', label: '中转站 API', icon: <ServerIcon /> },
];

export function Sidebar(props: SidebarProps) {
  const {
    sessions, currentSessionId, activeRoute, sidebarOpen,
    getAgent, onNewChat, onSelectSession, onDeleteSession, onNavigate,
  } = props;
  const isAgentRoute = activeRoute === 'agent';

  return (
    <aside
      className="flex flex-col flex-shrink-0 transition-all duration-300 overflow-hidden"
      style={{ width: sidebarOpen ? 260 : 0, backgroundColor: 'var(--td-bg-color-container)' }}
    >
      <div className="h-14 px-4 flex items-center flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--td-brand-color), var(--td-brand-color-hover))' }}
          >
            <span className="text-white text-sm font-bold">{APP_CONFIG.nameInitial}</span>
          </div>
          <span className="text-base font-semibold truncate" style={{ color: 'var(--td-text-color-primary)' }}>
            {APP_CONFIG.name}
          </span>
        </div>
      </div>

      <div className="px-2 pt-2 pb-3 space-y-0.5 flex-shrink-0">
        {NAV_ITEMS.map(item => {
          const active = activeRoute === item.key;
          return (
            <button
              key={item.key}
              type="button"
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                backgroundColor: active ? 'var(--td-brand-color-light)' : 'transparent',
                color: active ? 'var(--td-brand-color)' : 'var(--td-text-color-secondary)',
              }}
              onClick={() => onNavigate(item.key)}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'var(--td-bg-color-component-hover)'; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <span className="flex-shrink-0 flex items-center justify-center w-5 h-5">{item.icon}</span>
              <span className="flex-1 text-left truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {isAgentRoute && (
        <>
          <div className="px-3 pb-2">
            <Button icon={<AddIcon />} onClick={onNewChat} block variant="outline" size="small">
              新对话
            </Button>
          </div>
          <div className="px-3 pt-1 pb-1 text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
            历史会话
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sessions.map(session => {
              const sessionAgent = session.agentId ? getAgent(session.agentId) : getAgent('default');
              const AgentIcon = ICON_MAP[sessionAgent?.icon || 'Bot'] || Bot;
              const isCurrent = session.id === currentSessionId;
              return (
                <div
                  key={session.id}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors duration-200 group"
                  style={{
                    backgroundColor: isCurrent ? 'var(--td-brand-color-light)' : 'transparent',
                    color: isCurrent ? 'var(--td-brand-color)' : 'var(--td-text-color-secondary)',
                  }}
                  onClick={() => onSelectSession(session.id)}
                  onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.backgroundColor = 'var(--td-bg-color-component-hover)'; }}
                  onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <div
                    className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center"
                    style={{ backgroundColor: sessionAgent?.color || 'var(--td-brand-color)' }}
                  >
                    <AgentIcon size={12} color="white" />
                  </div>
                  <span className="flex-1 truncate text-sm">{session.title}</span>
                  <Tooltip content="删除会话">
                    <Button
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      variant="text" shape="circle" size="medium"
                      icon={<DeleteIcon />}
                      onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                    />
                  </Tooltip>
                </div>
              );
            })}
            {sessions.length === 0 && (
              <div className="px-3 py-6 text-center text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
                暂无会话
              </div>
            )}
          </div>
        </>
      )}

      {!isAgentRoute && <div className="flex-1" />}

      <div className="p-3 border-t flex-shrink-0" style={{ borderColor: 'var(--td-component-border)' }}>
        <Button
          icon={<SettingIcon />}
          onClick={() => onNavigate('settings')}
          block
          variant={activeRoute === 'settings' ? 'outline' : 'text'}
          theme={activeRoute === 'settings' ? 'primary' : 'default'}
        >
          设置
        </Button>
      </div>
    </aside>
  );
}
