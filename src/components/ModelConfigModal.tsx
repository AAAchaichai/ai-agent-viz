import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';
import { APIKeyInput } from './APIKeyInput';
import { ModelSelector } from './ModelSelector';
import type { ModelConfig } from '../types';
import './ModelConfigModal.css';

interface ModelConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, config: ModelConfig) => void;
  presetModels: ModelConfig[];
}

export const ModelConfigModal: React.FC<ModelConfigModalProps> = ({
  isOpen,
  onClose,
  onSave,
  presetModels
}) => {
  const [step, setStep] = useState<'preset' | 'config'>('preset');
  const [selectedPreset, setSelectedPreset] = useState<ModelConfig | null>(null);
  const [agentName, setAgentName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2000);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (selectedPreset) {
      setBaseUrl(selectedPreset.baseUrl);
      setModel(selectedPreset.model);
      setTemperature(selectedPreset.temperature ?? 0.7);
      setMaxTokens(selectedPreset.maxTokens ?? 2000);
    }
  }, [selectedPreset]);

  const handleSelectPreset = (preset: ModelConfig) => {
    setSelectedPreset(preset);
    setStep('config');
  };

  const handleTestConnection = async () => {
    if (!selectedPreset) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await apiClient.testModelConnection({
        ...selectedPreset,
        baseUrl,
        apiKey,
        model,
        temperature,
        maxTokens
      });
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : '测试失败'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    if (!selectedPreset || !agentName.trim()) return;

    const config: ModelConfig = {
      ...selectedPreset,
      baseUrl,
      apiKey,
      model,
      temperature,
      maxTokens,
      enabled: true
    };

    onSave(agentName, config);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setStep('preset');
    setSelectedPreset(null);
    setAgentName('');
    setApiKey('');
    setBaseUrl('');
    setModel('');
    setTemperature(0.7);
    setMaxTokens(2000);
    setTestResult(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{step === 'preset' ? '🤖 添加 Agent' : '⚙️ 配置模型'}</h2>
          <button className="close-btn" onClick={handleClose}>&times;</button>
        </div>

        <div className="modal-body">
          {step === 'preset' ? (
            <ModelSelector
              models={presetModels}
              selectedId={selectedPreset?.id}
              onSelect={handleSelectPreset}
            />
          ) : (
            <div className="config-form">
              <button className="back-btn" onClick={() => setStep('preset')}>
                ← 返回选择
              </button>

              <div className="form-group">
                <label>Agent 名称 *</label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="例如: Claude助手"
                />
              </div>

              <div className="form-group">
                <label>API Base URL</label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.example.com/v1"
                />
              </div>

              <div className="form-group">
                <label>API Key *</label>
                <APIKeyInput
                  value={apiKey}
                  onChange={setApiKey}
                  placeholder="sk-..."
                />
              </div>

              <div className="form-group">
                <label>模型名称</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="gpt-4o-mini"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Temperature ({temperature})</label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  />
                </div>

                <div className="form-group">
                  <label>Max Tokens</label>
                  <input
                    type="number"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                    min="1"
                    max="8192"
                  />
                </div>
              </div>

              {testResult && (
                <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                  <span className="result-icon">
                    {testResult.success ? '✅' : '❌'}
                  </span>
                  {testResult.message}
                </div>
              )}

              <div className="form-actions">
                <button
                  className="btn-test"
                  onClick={handleTestConnection}
                  disabled={isTesting || !apiKey.trim()}
                >
                  {isTesting ? (
                    <>
                      <span className="spinner"></span>
                      测试中...
                    </>
                  ) : (
                    '🔌 测试连接'
                  )}
                </button>
                <button
                  className="btn-save"
                  onClick={handleSave}
                  disabled={!agentName.trim() || !apiKey.trim()}
                >
                  ✨ 创建 Agent
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
