import { VERSION, BUILD_TIME, BUILD_NUMBER } from '../version';
import './VersionInfo.css';

export const VersionInfo: React.FC = () => {
  return (
    <div className="version-info">
      <span className="version-badge">{VERSION}</span>
      <span className="build-info">Build #{BUILD_NUMBER}</span>
      <span className="build-time">{BUILD_TIME}</span>
    </div>
  );
};
