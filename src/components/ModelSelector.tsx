import React from 'react';
import type { ModelConfig } from '../types';
import './ModelSelector.css';

interface ModelSelectorProps {
  models: ModelConfig[];
  selectedId?: string;
  onSelect: (model: ModelConfig) => void;
  disabled?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedId,
  onSelect,
  disabled = false
}) => {
  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'openai':
        return '🤖';
      case 'anthropic':
        return '🧠';
      case 'ollama':
        return '🦙';
      case 'kimi':
        return '🌙';
      default:
        return '🔮';
    }
  };

  const getProviderColor = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'openai':
        return '#10a37f';
      case 'anthropic':
        return '#d97757';
      case 'ollama':
        return '#ff6b6b';
      case 'kimi':
        return '#6b4ce6';
      default:
        return '#6b7280';
    }
  };

  return (
    <div className="model-selector">
      <label className="selector-label">选择模型提供商</label>
      <div className="model-grid">
        {models.map((model) => (
          <button
            key={model.id}
            className={`model-card ${selectedId === model.id ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
            onClick={() => !disabled && onSelect(model)}
            disabled={disabled}
            style={{ '--provider-color': getProviderColor(model.provider) } as React.CSSProperties}
          >
            <div className="model-icon">{getProviderIcon(model.provider)}</div>
            <div className="model-info">
              <div className="model-name">{model.name}</div>
              <div className="model-provider">{model.provider}</div>
            </div>
            {selectedId === model.id && (
              <div className="selected-check">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
