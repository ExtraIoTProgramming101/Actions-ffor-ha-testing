class RingBrightnessCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._dragging = false;
    this._throttleTimer = null;
    this._animationFrame = null;
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('Debes especificar una entidad (entity)');
    }
    
    this.config = {
      entity: config.entity,
      name: config.name || null,
      image: config.image || null,
      size: Number(config.size) || 180,
      stroke: Number(config.stroke) || 14,
      start_angle: config.start_angle ?? 300,
      end_angle: config.end_angle ?? 120,
      throttle_delay: config.throttle_delay ?? 50,
      show_percentage: config.show_percentage ?? true,
      show_state: config.show_state ?? true,
      gradient_start: config.gradient_start || '#ffd54f',
      gradient_end: config.gradient_end || '#fe5000',
      tap_action: config.tap_action || { action: 'toggle' },
      ...config
    };
  }

  set hass(hass) {
    const oldBrightness = this._entity?.attributes?.brightness;
    this._hass = hass;
    const entity = hass.states[this.config.entity];
    
    if (!entity) {
      this._renderError();
      return;
    }
    
    const newBrightness = entity.attributes.brightness;
    const oldState = this._entity?.state;
    this._entity = entity;
    
    if (!this._isInitialized) {
      this._initializeCard();
      this._isInitialized = true;
    } else if (oldBrightness !== newBrightness || oldState !== entity.state) {
      this._updateState(newBrightness);
    }
  }

  _renderError() {
    this.shadowRoot.innerHTML = `
      <ha-card>
        <div style="padding: 16px; color: red;">
          ⚠️ Entidad "${this.config.entity}" no encontrada
        </div>
      </ha-card>
    `;
  }

  _initializeCard() {
    const { size, stroke } = this.config;
    const r = (size - stroke) / 2;
    const cx = size / 2;
    const cy = size / 2;
    const imgSize = size - stroke * 1.5;
    const imgOffset = stroke * 0.75;

    const entityPicture = this._entity.attributes.entity_picture;
    const useImage = this.config.image || entityPicture;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
          width: ${size}px;
          height: ${size + 30}px;
          position: relative;
          z-index: 0;
        }
        ha-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          position: relative;
          z-index: 0;
          background: none !important;
          box-shadow: none !important;
          border: none;
        }
        .card-container {
          width: ${size}px;
          height: ${size}px;
          position: relative;
        }
        svg {
          width: 100%;
          height: 100%;
          position: absolute;
          top: 0;
          left: 0;
          transform: rotate(0deg);
        }
        .ring-layer {
          position: absolute;
          inset: 0;
          z-index: 10;
          touch-action: none;
          cursor: pointer;
          border-radius: 50%;
          clip-path: circle(50% at 50% 50%) subtract circle(${(imgSize/size)*50}% at 50% 50%);
          -webkit-mask: radial-gradient(transparent ${imgSize/2}px, black ${imgSize/2 + 1}px);
          mask: radial-gradient(transparent ${imgSize/2}px, black ${imgSize/2 + 1}px);
        }
        .center-content {
          position: absolute;
          top: ${imgOffset}px;
          left: ${imgOffset}px;
          width: ${imgSize}px;
          height: ${imgSize}px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          cursor: pointer;
          z-index: 15;
          background: var(--card-background-color, #fff);
          transition: transform 0.1s ease;
        }
        .center-content:active {
          transform: scale(0.95);
        }
        .center-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .center-icon {
          font-size: ${imgSize * 0.5}px;
          color: var(--primary-text-color);
        }
        .percentage-overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #fff;
          background: rgba(0, 0, 0, 0.9);
          padding: 6px 12px;
          border-radius: 16px;
          font-size: 14px;
          font-weight: 600;
          z-index: 20;
          opacity: 0;
          transition: opacity 0.2s ease;
          pointer-events: none;
        }
        .percentage-overlay.visible {
          opacity: 1;
        }
        .entity-label {
          font-size: 0.9em;
          color: var(--primary-text-color);
          text-align: center;
          max-width: ${size}px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .state-label {
          font-size: 0.75em;
          color: var(--secondary-text-color);
          text-align: center;
        }
        .progress {
          transition: stroke-dashoffset 0.15s ease-out;
          will-change: stroke-dashoffset;
        }
      </style>

      <ha-card>
        <div class="card-container">
          <svg viewBox="0 0 ${size} ${size}">
            <defs>
              <linearGradient id="grad-${this.config.entity.replace(/\./g, '-')}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${this.config.gradient_start};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${this.config.gradient_end};stop-opacity:1" />
              </linearGradient>
            </defs>
            
            <path
              class="background-arc"
              d="${this._describeArc(cx, cy, r, this.config.start_angle, this.config.end_angle)}"
              fill="none"
              stroke="var(--disabled-text-color, rgba(0,0,0,0.1))"
              stroke-width="${stroke}"
              stroke-linecap="round"
              opacity="0.3"
            />
            
            <path
              class="progress"
              d="${this._describeArc(cx, cy, r, this.config.start_angle, this.config.end_angle)}"
              fill="none"
              stroke="url(#grad-${this.config.entity.replace(/\./g, '-')})"
              stroke-width="${stroke}"
              stroke-linecap="round"
            />
          </svg>
          
          <div class="center-content">
            ${useImage 
              ? `<img class="center-image" src="${useImage}" alt="${this._entity.attributes.friendly_name || ''}">`
              : `<ha-icon class="center-icon" icon="${this._entity.attributes.icon || 'mdi:lightbulb'}"></ha-icon>`
            }
          </div>
          
          <div class="ring-layer"></div>
          <div class="percentage-overlay">${this._getBrightnessPercent()}%</div>
        </div>
        
        ${this.config.show_state ? `
          <div class="entity-label">${this.config.name || this._entity.attributes.friendly_name || this.config.entity}</div>
          <div class="state-label">${this._getStateLabel()}</div>
        ` : ''}
      </ha-card>
    `;

    this._progressPath = this.shadowRoot.querySelector('.progress');
    this._percentOverlay = this.shadowRoot.querySelector('.percentage-overlay');
    this._ringLayer = this.shadowRoot.querySelector('.ring-layer');
    this._centerContent = this.shadowRoot.querySelector('.center-content');
    this._stateLabel = this.shadowRoot.querySelector('.state-label');

    this._cachedValues = { cx, cy, r };

    const pathLength = this._progressPath.getTotalLength();
    this._progressPath.style.strokeDasharray = pathLength;
    this._pathLength = pathLength;

    this._updateState(this._entity.attributes.brightness || 0);

    // Event listener para el anillo (drag)
    this._ringLayer.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._startDrag(e);
    });

    // Event listener para el centro (tap action)
    this._centerContent.addEventListener('click', (e) => {
      e.stopPropagation();
      this._handleTapAction();
    });
  }

  _startDrag(e) {
    this._dragging = true;
    this._hasDragged = false; // Flag para detectar si realmente se arrastró
    this._cachedRect = this.shadowRoot.querySelector('.card-container').getBoundingClientRect();
    
    if (this.config.show_percentage) {
      this._percentOverlay.classList.add('visible');
    }

    const move = (ev) => {
      ev.preventDefault();
      this._hasDragged = true; // Se detectó movimiento
      
      if (this._animationFrame) {
        cancelAnimationFrame(this._animationFrame);
      }
      
      this._animationFrame = requestAnimationFrame(() => {
        this._onPointerMove(ev);
      });
    };
    
    const up = () => {
      this._dragging = false;
      this._cachedRect = null;
      
      if (this.config.show_percentage) {
        setTimeout(() => {
          this._percentOverlay.classList.remove('visible');
        }, 300);
      }
      
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      
      if (this._animationFrame) {
        cancelAnimationFrame(this._animationFrame);
      }
    };
    
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    
    // Iniciar con el primer punto
    this._onPointerMove(e);
  }

  _onPointerMove(e) {
    if (!this._dragging) return;

    const rect = this._cachedRect;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;

    // Calcular ángulo (en sentido horario desde las 12 en punto)
    let deg = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    if (deg < 0) deg += 360;

    const { start_angle, end_angle } = this.config;
    const arcLen = this._calcArcLength(start_angle, end_angle);

    // CORRECCIÓN: Invertir la posición relativa para sentido horario
    let rel = this._getRelativePosition(deg, start_angle, end_angle, arcLen);
    
    if (rel === null) return;

    // INVERTIR: 1 - rel para que vaya en sentido horario
    rel = Math.max(0, Math.min(rel, 1));
    
    const brightness = Math.round(rel * 255);
    const brightnessPct = Math.round(rel * 100);

    this._updateProgressVisual(rel);
    this._percentOverlay.textContent = `${brightnessPct}%`;

    this._throttledServiceCall(brightness);
  }

  _getRelativePosition(deg, start, end, arcLen) {
    let rel;
    
    if (end > start) {
      if (deg < start || deg > end) return null;
      rel = (deg - start) / arcLen;
    } else {
      // Arco que cruza 0° (ej: 300° a 120°)
      if (deg > end && deg < start) return null;
      if (deg >= start) {
        rel = (deg - start) / arcLen;
      } else {
        rel = ((360 - start) + deg) / arcLen;
      }
    }
    
    return rel;
  }

  _updateProgressVisual(rel) {
    // strokeDashoffset para animación suave
    const offset = this._pathLength * (1 + rel);
    this._progressPath.style.strokeDashoffset = offset;
  }

  _updateState(brightnessRaw) {
    if (!this._progressPath) return;

    const rel = (brightnessRaw || 0) / 255;
    this._updateProgressVisual(rel);

    if (this._stateLabel) {
      this._stateLabel.textContent = this._getStateLabel();
    }
  }

  _throttledServiceCall(brightness) {
    if (this._throttleTimer) {
      clearTimeout(this._throttleTimer);
    }
    
    this._throttleTimer = setTimeout(() => {
      this._hass.callService('light', 'turn_on', {
        entity_id: this.config.entity,
        brightness: brightness
      });
      this._throttleTimer = null;
    }, this.config.throttle_delay);
  }

  _handleTapAction() {
    const action = this.config.tap_action || { action: 'toggle' };
    
    switch (action.action) {
      case 'toggle':
        this._hass.callService('homeassistant', 'toggle', {
          entity_id: this.config.entity
        });
        break;
      
      case 'turn_on':
        this._hass.callService('light', 'turn_on', {
          entity_id: this.config.entity
        });
        break;
      
      case 'turn_off':
        this._hass.callService('light', 'turn_off', {
          entity_id: this.config.entity
        });
        break;
      
      case 'more-info':
        const event = new Event('hass-more-info', {
          bubbles: true,
          composed: true
        });
        event.detail = { entityId: this.config.entity };
        this.dispatchEvent(event);
        break;
      
      case 'navigate':
        if (action.navigation_path) {
          window.history.pushState(null, '', action.navigation_path);
          const navEvent = new Event('location-changed', {
            bubbles: true,
            composed: true
          });
          window.dispatchEvent(navEvent);
        }
        break;
      
      case 'call-service':
        if (action.service) {
          const [domain, service] = action.service.split('.');
          this._hass.callService(domain, service, action.service_data || {});
        }
        break;
      
      case 'none':
      default:
        // No hacer nada
        break;
    }
  }

  _getBrightnessPercent() {
    const brightness = this._entity?.attributes?.brightness || 0;
    return Math.round((brightness / 255) * 100);
  }

  _getStateLabel() {
    if (this._entity.state === 'on') {
      return `🔆 Encendida - ${this._getBrightnessPercent()}%`;
    }
    return '🌙 Apagada';
  }

  _calcArcLength(start, end) {
    let diff = end - start;
    if (diff < 0) diff += 360;
    return diff;
  }

  _polarToCartesian(cx, cy, r, angleDeg) {
    const rad = (angleDeg - 90) * Math.PI / 180.0;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad)
    };
  }

  _describeArc(x, y, r, startAngle, endAngle) {
    const start = this._polarToCartesian(x, y, r, endAngle);
    const end = this._polarToCartesian(x, y, r, startAngle);
    const arcLength = this._calcArcLength(startAngle, endAngle);
    const largeArcFlag = arcLength <= 180 ? '0' : '1';
    
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  }

  disconnectedCallback() {
    if (this._throttleTimer) {
      clearTimeout(this._throttleTimer);
    }
    if (this._animationFrame) {
      cancelAnimationFrame(this._animationFrame);
    }
  }

  getCardSize() {
    return 3;
  }

  static getStubConfig() {
    return { 
      entity: 'light.example',
      size: 180,
      stroke: 14
    };
  }
}

customElements.define('ring-brightness-card', RingBrightnessCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'ring-brightness-card',
  name: 'Ring Brightness Card',
  description: 'Control circular de brillo con imagen personalizable'
});

console.log('✅ Ring Brightness Card con sentido horario y tap_action');
