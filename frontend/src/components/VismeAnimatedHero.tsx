import React, { useState } from 'react';
import { Sparkles, RefreshCw, LayoutTemplate, Layers } from 'lucide-react';
import { LoginLogoHero } from './LoginLogoHero';

interface VismeAnimatedHeroProps {
  initialMode?: 'visme' | 'brand';
}

export const VismeAnimatedHero: React.FC<VismeAnimatedHeroProps> = ({
  initialMode = 'visme'
}) => {
  const [activeTab, setActiveTab] = useState<'visme' | 'brand'>(initialMode);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);

  const handleReload = () => {
    setIsLoading(true);
    setIframeKey(k => k + 1);
  };

  return (
    <div className="as-visme-hero-container">
      {/* Radiant ambient background glow */}
      <div className="as-visme-halo" aria-hidden="true" />

      {/* Top Header Controls: Switch between 3D Visme Animation and Brand Hero */}
      <div className="as-visme-hero-nav">
        <div className="as-visme-badge">
          <Sparkles size={13} className="as-sparkle-icon" />
          <span>Interactive 3D Experience</span>
        </div>

        <div className="as-visme-tabs">
          <button
            type="button"
            className={`as-visme-tab-btn ${activeTab === 'visme' ? 'active' : ''}`}
            onClick={() => setActiveTab('visme')}
            title="View 3D Animated Interactive Form"
          >
            <Layers size={13} />
            <span>3D Animation</span>
          </button>
          <button
            type="button"
            className={`as-visme-tab-btn ${activeTab === 'brand' ? 'active' : ''}`}
            onClick={() => setActiveTab('brand')}
            title="View Official School Brand Showcase"
          >
            <LayoutTemplate size={13} />
            <span>Brand Logo</span>
          </button>
        </div>
      </div>

      {/* Dynamic Content: Visme Animated Embed vs Brand Logo */}
      {activeTab === 'brand' ? (
        <div className="as-visme-brand-view animate-fade-in">
          <LoginLogoHero />
        </div>
      ) : (
        <div className="as-visme-iframe-card animate-fade-in">
          {/* Action bar on top of the iframe card */}
          <div className="as-visme-card-header">
            <div className="as-visme-status-dot-row">
              <span className="as-visme-live-dot" />
              <span className="as-visme-status-text">Visme 3D Animated Character</span>
            </div>
            <button
              type="button"
              className="as-visme-reload-btn"
              onClick={handleReload}
              title="Restart 3D Animation"
            >
              <RefreshCw size={13} className={isLoading ? 'as-spin' : ''} />
              <span>Restart</span>
            </button>
          </div>

          {/* Iframe Viewport with loading skeleton */}
          <div className="as-visme-viewport">
            {isLoading && (
              <div className="as-visme-skeleton">
                <div className="as-visme-spinner" />
                <p className="as-visme-loading-text">Loading 3D interactive character...</p>
              </div>
            )}

            <iframe
              key={iframeKey}
              src="https://forms.visme.co/formsPlayer/_embed/vm881x4j-workshop-registration-form?embedIframeId=1"
              title="Visme 3D Interactive Animated Form"
              className={`as-visme-iframe ${isLoading ? 'loading' : 'ready'}`}
              onLoad={() => setIsLoading(false)}
              allow="autoplay; fullscreen"
              loading="eager"
            />
          </div>

          {/* Helpful bottom hint */}
          <div className="as-visme-card-footer">
            <span>✨ Live animated character demo. Use the right form to sign in to your AttendoSchool portal.</span>
          </div>
        </div>
      )}
    </div>
  );
};
