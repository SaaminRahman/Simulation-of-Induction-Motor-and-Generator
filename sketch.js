import Complex from 'https://esm.sh/complex.js';

    window.setupUI = setupUI;
    window.solveForF = solveForF;
    window.solveForXm = solveForXm;
    window.evaluateImaginaryAdmittance = evaluateImaginaryAdmittance;
    window.evaluateRealAdmittance = evaluateRealAdmittance;

    // Global animation time tracking
    let simTime = 0;
    let isPlaying = true;

    function safeInverse(z) {
      let mag2 = z.re * z.re + z.im * z.im;
      if (mag2 < 1e-10) return new Complex(1e5, 0);
      return z.inverse();
    }

    function safeDiv(num, den) {
      if (den instanceof Complex) {
        let mag2 = den.re * den.re + den.im * den.im;
        if (mag2 < 1e-10) return new Complex(1e5, 0);
        return num.div(den);
      } else {
        if (Math.abs(den) < 1e-10) return new Complex(1e5, 0);
        return num.div(den);
      }
    }

    // On-Canvas Legend Renderer
    function drawVisualLegend(p) {
      p.push();
      p.resetMatrix(); // Reset any transformations to draw in screen space consistently
      p.fill(255, 255, 255, 245);

      p.textSize(11);
      p.textStyle(p.BOLD);
      p.textAlign(p.LEFT, p.CENTER);
      p.noStroke();
      p.fill(0);
      p.text("MAGNETIC FIELD VECTORS", 25, p.height - 40);
      p.stroke(0);
      p.strokeWeight(1);
      p.fill(255, 0, 0); p.rect(25, p.height - 30 , 14, 10); p.noStroke(); p.fill(0); p.text("Bs : Stator Field", 48, p.height - 25);
      p.stroke(0); p.fill(0, 200, 0); p.rect(150, p.height - 30, 14, 10); p.noStroke(); p.fill(0); p.text("Bm : Magnetizing Field", 170, p.height - 25);
      p.stroke(0); p.fill(0, 0, 255); p.rect(310, p.height - 30, 14, 10); p.noStroke(); p.fill(0); p.text("Bl : Load Field", 330, p.height - 25);
      p.stroke(0); p.fill(255, 0, 255); p.rect(430, p.height - 30, 14, 10); p.noStroke(); p.fill(0); p.text("Br : Rotor Field", 450, p.height - 25);
      p.pop();
    }

    function setupUI() {
      let ui = document.getElementById('controls-ui');
      ui.innerHTML = '';
      let animGroup = document.createElement('div');
      animGroup.className = 'input-group common-input';
      animGroup.style.borderBottom = '2px solid #000';
      animGroup.style.paddingBottom = '15px';
      animGroup.style.marginBottom = '20px';
      animGroup.innerHTML = `
            <div class="control-btns">
              <button id="playPauseBtn" title="Play/Pause Simulation"><i class="fas fa-pause"></i> Pause</button>
              <button id="resetTimeBtn" title="Reset Time to zero"><i class="fas fa-undo"></i> Reset t=0</button>
            </div>
            <div class="time-display-box">
              Time (t): <span id="timeValDisplay">0.0000</span> s
            </div>
            <div class="input-group">
              <label>Play Mode</label>
              <select id="playbackMode">
                <option value="auto" selected>Auto (Continuous)</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          `;
      ui.appendChild(animGroup);

      const updatePlaybackModeVisibility = () => {
        const mode = document.getElementById('playbackMode')?.value || 'auto';
        const manualGroup = document.getElementById('speedSliderGroup');
        const speedGroup = document.getElementById('animSpeedGroup');
        const controlBtns = animGroup.querySelector('.control-btns');
        const timeDispBox = animGroup.querySelector('.time-display-box');

        if (mode === 'manual') {
          if (manualGroup) manualGroup.style.display = 'block';
          if (speedGroup) speedGroup.style.display = 'none';
          if (controlBtns) controlBtns.style.display = 'none';
          if (timeDispBox) timeDispBox.style.display = 'none';
        } else {
          if (manualGroup) manualGroup.style.display = 'none';
          if (speedGroup) speedGroup.style.display = 'block';
          if (controlBtns) controlBtns.style.display = 'flex';
          if (timeDispBox) timeDispBox.style.display = 'block';
        }
      };

      const playBtn = animGroup.querySelector('#playPauseBtn');
      if (playBtn) {
        playBtn.addEventListener('click', () => {
          isPlaying = !isPlaying;
          playBtn.innerHTML = isPlaying ? '<i class="fas fa-pause"></i> Pause' : '<i class="fas fa-play"></i> Play';
        });
      }

      const resetBtn = animGroup.querySelector('#resetTimeBtn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          simTime = 0;
          const timeDisp = document.getElementById('timeValDisplay');
          if (timeDisp) timeDisp.innerText = "0.0000";
        });
      }

      const modeSelect = animGroup.querySelector('#playbackMode');
      if (modeSelect) modeSelect.addEventListener('change', updatePlaybackModeVisibility);

      const createField = (label, id, val, groupClass) => {
        let div = document.createElement('div');
        div.className = `input-group ${groupClass}`;
        div.innerHTML = `<label>${label}</label><input type="number" step="any" id="${id}" value="${val}">`;
        ui.appendChild(div);
      };

      const createSlider = (label, id, min, max, val, groupClass, containerId = null, step = 1, showConfig = false) => {
        let div = document.createElement('div');
        div.className = `input-group ${groupClass}`;
        if (containerId) div.id = containerId;

        let configHTML = '';
        if (showConfig) {
          configHTML = `
                <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: #333; margin-top: 4px; gap: 4px;">
                  <span style="display: flex; align-items: center; gap: 2px;">Min: <input type="number" step="any" id="${id}_min" value="${min}" style="width: 48px; font-size: 0.68rem; border: 1px solid #000; padding: 1px 2px; background: #fff;"></span>
                  <span style="display: flex; align-items: center; gap: 2px;">Step: <input type="number" step="any" id="${id}_step" value="${step}" style="width: 48px; font-size: 0.68rem; border: 1px solid #000; padding: 1px 2px; background: #fff;"></span>
                  <span style="display: flex; align-items: center; gap: 2px;">Max: <input type="number" step="any" id="${id}_max" value="${max}" style="width: 48px; font-size: 0.68rem; border: 1px solid #000; padding: 1px 2px; background: #fff;"></span>
                </div>
              `;
        }

        div.innerHTML = `
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label style="margin-bottom: 0;">${label}</label>
                <input type="number" step="any" id="${id}_val" value="${val}" min="${min}" max="${max}" style="width: 70px; text-align: right; border: 1px solid #000; font-weight: bold; padding: 2px; font-family: monospace;">
              </div>
              <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" style="width: 100%; accent-color: #000000;">
              ${configHTML}
            `;
        ui.appendChild(div);

        setTimeout(() => {
          const slider = document.getElementById(id);
          const valInput = document.getElementById(`${id}_val`);
          if (slider && valInput) {
            slider.addEventListener('input', () => valInput.value = slider.value);
            valInput.addEventListener('input', () => {
              let numVal = parseFloat(valInput.value);
              if (!isNaN(numVal)) slider.value = numVal;
            });
            if (showConfig) {
              const minInput = document.getElementById(`${id}_min`);
              const stepInput = document.getElementById(`${id}_step`);
              const maxInput = document.getElementById(`${id}_max`);
              minInput.addEventListener('input', () => { let numMin = parseFloat(minInput.value); if (!isNaN(numMin)) slider.min = numMin; });
              stepInput.addEventListener('input', () => { let numStep = parseFloat(stepInput.value); if (!isNaN(numStep) && numStep > 0) slider.step = numStep; });
              maxInput.addEventListener('input', () => { let numMax = parseFloat(maxInput.value); if (!isNaN(numMax)) slider.max = numMax; });
            }
          }
        }, 20);
      };

      createSlider("Rotor Bars", "barSlider", 6, 25, 10, "common-input", null, 1, false);
      createSlider("Speed Multiplier (Playback)", "timeSpeedSlider", 0.001, 0.005, 0.002, "common-input", "animSpeedGroup", 0.001, true);
      createSlider("Manual Time (s)", "speedSlider", 0, 0.01, 0, "common-input", "speedSliderGroup", 0.0001, true);

      setTimeout(updatePlaybackModeVisibility, 50);

      createField("Base Freq (Hz)", "fBase", "60", "common-input");
      createField("R1 (Ω)", "R1Input", "0.5", "common-input");
      createField("X1 (Ω)", "X1Input", "0.5", "common-input");
      createField("Rc (Ω)", "RcInput", "100", "common-input");
      createField("R2 (Ω)", "R2Input", "0.6", "common-input");
      createField("X2 (Ω)", "X2Input", "10.5", "common-input");

      createField("Xm (Ω)", "XmInput", "20", "grid-input");
      createField("V_in (V)", "VInput", "120", "grid-input");
      createField("Slip", "slipInput", "0.05", "grid-input");

      createField("Load R (Ω)", "RLInput", "150", "standalone-input");
      createField("Load X (Ω)", "XLInput", "0", "standalone-input");
      createField("Capacitor C (uF)", "CInput", "45", "standalone-input");
      createField("Prime Mover Freq (Hz)", "fi", "60", "standalone-input");
    }
    setupUI();

    function evaluateRealAdmittance(f, R1, X1, R2, X2, Rc, Xc, RL, XL, fi, baseFrequency) {
      let scalingFactor = f / baseFrequency;
      let freqDiff = f - fi;
      if (Math.abs(freqDiff) < 1e-5) freqDiff = Math.sign(freqDiff) * 1e-5 || 1e-5;

      let Z_rotor = new Complex(R2 * f / freqDiff, X2 * scalingFactor);
      let Y_rotor_real = safeInverse(Z_rotor).re;
      let Gc = 1 / (Math.abs(Rc) < 1e-5 ? 1e-5 : Rc);
      let Y_core_real = Gc;
      let excDenom = Xc / (scalingFactor === 0 ? 1e-5 : scalingFactor);
      let Y_exc = new Complex(0, 1 / (Math.abs(excDenom) < 1e-5 ? 1e-5 : excDenom));
      let load = new Complex(RL, XL * scalingFactor);
      let Y_load = safeInverse(load);
      let Y_terminal = Y_exc.add(Y_load);
      let Z_terminal = safeInverse(Y_terminal);
      let Z_stator = new Complex(R1, X1 * scalingFactor);
      let Z_stator_side = Z_stator.add(Z_terminal);
      let Y_stator_side_real = safeInverse(Z_stator_side).re;

      return Y_rotor_real + Y_core_real + Y_stator_side_real;
    }

    function evaluateImaginaryAdmittance(f, R1, X1, R2, X2, Xm, Xc, RL, XL, fi, baseFrequency) {
      let scalingFactor = f / baseFrequency;
      let freqDiff = f - fi;
      if (Math.abs(freqDiff) < 1e-5) freqDiff = Math.sign(freqDiff) * 1e-5 || 1e-5;

      let Z_rotor = new Complex(R2 * f / freqDiff, X2 * scalingFactor);
      let Y_rotor_imag = safeInverse(Z_rotor).im;
      let excDenom = Xc / (scalingFactor === 0 ? 1e-5 : scalingFactor);
      let Y_exc = new Complex(0, 1 / (Math.abs(excDenom) < 1e-5 ? 1e-5 : excDenom));
      let load = new Complex(RL, XL * scalingFactor);
      let Y_load = safeInverse(load);
      let Y_terminal = Y_exc.add(Y_load);
      let Z_terminal = safeInverse(Y_terminal);
      let Z_stator = new Complex(R1, X1 * scalingFactor);
      let Z_stator_side = Z_stator.add(Z_terminal);
      let Y_stator_side_imag = safeInverse(Z_stator_side).im;
      let xmScaling = Xm * scalingFactor;

      return Y_rotor_imag + Y_stator_side_imag + (-1 / (Math.abs(xmScaling) < 1e-5 ? 1e-5 : xmScaling));
    }

    function solveForF(R1, X1, R2, X2, Rc, Xc, RL, XL, fi, baseFrequency) {
      let low = 0.05;
      let high = fi - 1e-6;
      const evalY = (F) => evaluateRealAdmittance(F, R1, X1, R2, X2, Rc, Xc, RL, XL, fi, baseFrequency);
      let valLow = evalY(low);
      let valHigh = evalY(high);
      if (Math.sign(valLow) === Math.sign(valHigh)) return null;
      for (let i = 0; i < 40; i++) {
        let mid = (low + high) / 2;
        let valMid = evalY(mid);
        if (Math.sign(valLow) !== Math.sign(valMid)) { high = mid; valHigh = valMid; }
        else { low = mid; valLow = valMid; }
      }
      return (low + high) / 2;
    }

    function solveForXm(f, R1, X1, R2, X2, Xc, RL, XL, fi, baseFrequency) {
      let scalingFactor = f / baseFrequency;
      let freqDiff = f - fi;
      if (Math.abs(freqDiff) < 1e-5) freqDiff = Math.sign(freqDiff) * 1e-5 || 1e-5;

      let Z_rotor = new Complex(R2 * f / freqDiff, X2 * scalingFactor);
      let Y_rotor_imag = safeInverse(Z_rotor).im;
      let excDenom = Xc / (scalingFactor === 0 ? 1e-5 : scalingFactor);
      let Y_exc = new Complex(0, 1 / (Math.abs(excDenom) < 1e-5 ? 1e-5 : excDenom));
      let load = new Complex(RL, XL * scalingFactor);
      let Y_load = safeInverse(load);
      let Y_terminal = Y_exc.add(Y_load);
      let Z_terminal = safeInverse(Y_terminal);
      let Z_stator = new Complex(R1, X1 * scalingFactor);
      let Z_stator_side = Z_stator.add(Z_terminal);
      let Y_stator_side_imag = safeInverse(Z_stator_side).im;

      return 1 / (Y_stator_side_imag + Y_rotor_imag);
    }

    function validateSimulationInputs(mode) {
      let errors = [];
      let R1 = parseFloat(document.getElementById('R1Input')?.value || 0);
      let X1 = parseFloat(document.getElementById('X1Input')?.value || 0);
      let Rc = parseFloat(document.getElementById('RcInput')?.value || 0);
      let R2 = parseFloat(document.getElementById('R2Input')?.value || 0);
      let X2 = parseFloat(document.getElementById('X2Input')?.value || 0);
      let numRotorBars = parseInt(document.getElementById('barSlider')?.value || 0);
      let baseFreq = parseFloat(document.getElementById('fBase')?.value || 0);

      if (isNaN(R1) || R1 < 0) errors.push("Stator resistance (R1) cannot be negative.");
      if (isNaN(X1) || X1 < 0) errors.push("Stator leakage reactance (X1) cannot be negative.");
      if (isNaN(Rc) || Rc < 0.001) errors.push("Core resistance (Rc) must be at least 0.001 Ω.");
      if (isNaN(numRotorBars) || numRotorBars < 6) errors.push("Rotor bars count cannot go below 6.");
      if (isNaN(baseFreq) || baseFreq <= 0.05) errors.push("Base frequency must be greater than 0.05 Hz.");
      if (R2 === 0 && X2 === 0) errors.push("Rotor resistance (R2) and leakage reactance (X2) cannot both be zero at the same time.");
      if (R2 < 0 || X2 < 0) errors.push("Rotor parameters (R2, X2) cannot be negative.");

      if (mode === 'grid') {
        let Xm = parseFloat(document.getElementById('XmInput')?.value || 0);
        let slip = parseFloat(document.getElementById('slipInput')?.value || 0);
        if (isNaN(Xm) || Xm < 0.001) errors.push("Magnetizing reactance (Xm) must be at least 0.001 Ω.");
        if (Math.abs(slip) < 0.0001) errors.push("Slip must not be within [-0.0001, 0.0001] to avoid mathematical division issues.");
      } else if (mode === 'standalone') {
        let RL = parseFloat(document.getElementById('RLInput')?.value || 0);
        let XL = parseFloat(document.getElementById('XLInput')?.value || 0);
        let C = parseFloat(document.getElementById('CInput')?.value || 0);
        if (isNaN(C) || C <= 0.01) errors.push("Capacitor C must be at least 0.01 uF to generate excitation.");
        if (RL === 0 && XL === 0) errors.push("Load Resistance (RL) and Load Reactance (XL) cannot both be zero at the same time.");
        if (RL < 0) errors.push("Load resistance (RL) cannot be negative.");
      }
      return errors;
    }

    function updateErrorOverlay(errors, containerId) {
      let container = document.getElementById(containerId);
      if (!container) return;
      let existingOverlay = container.querySelector('.sim-validation-overlay');
      if (existingOverlay) existingOverlay.remove();
      if (errors.length === 0) return;

      let overlay = document.createElement('div');
      overlay.className = 'sim-validation-overlay';
      overlay.style.position = 'absolute';
      overlay.style.top = '25px';
      overlay.style.left = '50%';
      overlay.style.transform = 'translateX(-50%)';
      overlay.style.width = '85%';
      overlay.style.maxWidth = '450px';
      overlay.style.backgroundColor = '#fff5f5';
      overlay.style.border = '2px solid #ff0000';
      overlay.style.boxShadow = '8px 8px 0px #ff0000';
      overlay.style.padding = '15px 20px';
      overlay.style.zIndex = '999';
      overlay.style.fontFamily = 'inherit';

      let header = document.createElement('div');
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      header.style.gap = '8px';
      header.style.color = '#b30000';
      header.style.fontWeight = 'bold';
      header.style.fontSize = '0.95rem';
      header.style.textTransform = 'uppercase';
      header.style.marginBottom = '10px';
      header.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Parameter Invalid';
      overlay.appendChild(header);

      let list = document.createElement('ul');
      list.style.margin = '0';
      list.style.paddingLeft = '18px';
      list.style.color = '#333333';
      list.style.fontSize = '0.85rem';

      errors.forEach(err => {
        let item = document.createElement('li');
        item.style.marginBottom = '6px';
        item.innerText = err;
        list.appendChild(item);
      });
      overlay.appendChild(list);
      container.appendChild(overlay);
    }

    function updateSimulationClock(p) {
      if (isPlaying) {
        const playMode = document.getElementById('playbackMode')?.value || 'auto';
        if (playMode === 'auto') {
          const spdScalar = parseFloat(document.getElementById('timeSpeedSlider')?.value || 0.05);
          let dt = Math.min(p.deltaTime / 1000, 0.1);
          simTime += dt * spdScalar;
          const timeDisp = document.getElementById('timeValDisplay');
          if (timeDisp) timeDisp.innerText = simTime.toFixed(4);
        }
      }
    }

    function dashLine(x1, y1, x2, y2, dashLen, gapLen, color, p) {
      p.stroke(color);
      let d = p.dist(x1, y1, x2, y2);
      let segments = d / (dashLen + gapLen);
      let angle = p.atan2(y2 - y1, x2 - x1);
      for (let i = 0; i < segments; i++) {
        let xStart = x1 + p.cos(angle) * (i * (dashLen + gapLen));
        let yStart = y1 + p.sin(angle) * (i * (dashLen + gapLen));
        let xEnd = xStart + p.cos(angle) * dashLen;
        let yEnd = yStart + p.sin(angle) * dashLen;
        p.line(xStart, yStart, xEnd, yEnd);
      }
    }

    const motorSketch = (p) => {
      let container;
      p.setup = () => {
        container = document.getElementById('motor-container');
        p.createCanvas(container.clientWidth, container.clientHeight).parent('motor-container');
      };

      p.draw = () => {
        // Responsive Canvas Resize Check
        if (p.width !== container.clientWidth || p.height !== container.clientHeight) {
          if (container.clientWidth > 0 && container.clientHeight > 0) {
            p.resizeCanvas(container.clientWidth, container.clientHeight);
          }
        }

        let validationErrors = validateSimulationInputs('grid');
        updateErrorOverlay(validationErrors, 'motor-container');

        if (validationErrors.length > 0) {
          p.background(245);
          p.fill(150); p.noStroke(); p.textAlign(p.CENTER, p.CENTER); p.textSize(16);
          p.text("Simulation suspended due to parameter errors.", p.width / 2, p.height / 2);
          return;
        }

        if (document.body.classList.contains('mode-grid')) {
          updateSimulationClock(p);
        }

        p.background(255);

        // Collect Input
        let R1 = parseFloat(document.getElementById('R1Input').value);
        let X1 = parseFloat(document.getElementById('X1Input').value);
        let Rc = parseFloat(document.getElementById('RcInput').value);
        let Xm = parseFloat(document.getElementById('XmInput').value);
        let R2 = parseFloat(document.getElementById('R2Input').value);
        let X2 = parseFloat(document.getElementById('X2Input').value);
        let V = parseFloat(document.getElementById('VInput').value);
        let slipVal = parseFloat(document.getElementById('slipInput').value);
        let numRotorBars = parseInt(document.getElementById('barSlider').value);

        const playMode = document.getElementById('playbackMode')?.value || 'auto';
        let speedFactor = playMode === 'manual' ? parseFloat(document.getElementById('speedSlider').value) : simTime;

        let Z_R2_X2 = new Complex(R2 / slipVal, X2);
        let Z_Rc = new Complex(Rc, 0);
        let Z_Xm = new Complex(0, Xm);
        let Z_R1_X1 = new Complex(R1, X1);
        let Vin = new Complex(V, 0);

        let equivMagnetizingBranchImpedance = safeInverse(safeInverse(Z_Rc).add(safeInverse(Z_Xm)));
        let rotorTheveninConductance = safeInverse(Z_R2_X2).add(safeInverse(equivMagnetizingBranchImpedance));
        let statorTheveninImpedance = safeInverse(safeInverse(Z_R1_X1).add(safeInverse(equivMagnetizingBranchImpedance)));
        let VThevenin = Vin.mul(safeDiv(equivMagnetizingBranchImpedance, equivMagnetizingBranchImpedance.add(Z_R1_X1)));
        let inducedTorque = 3 * ((safeDiv(VThevenin, statorTheveninImpedance.add(Z_R2_X2)).abs()) ** 2) * (R2 / p.abs(slipVal));
        let startingTorque = 3 * ((safeDiv(VThevenin, statorTheveninImpedance.add(Complex(R2, X2))).abs()) ** 2) * (R2);
        let eqvImpedance = Z_R1_X1.add(safeInverse(rotorTheveninConductance));

        let statorCurrent = safeDiv(Vin, eqvImpedance);
        let magnetizationCurrent = safeDiv(safeDiv(safeDiv(Vin, eqvImpedance), rotorTheveninConductance), Z_Xm);
        let loadCurrent = safeDiv(safeDiv(statorCurrent, rotorTheveninConductance), Z_R2_X2);

        if (document.body.classList.contains('mode-grid')) {
          document.getElementById('induced-torque').innerText = inducedTorque.toFixed(2);
          document.getElementById('res-stator-current').innerText = statorCurrent.abs().toFixed(2);
          document.getElementById('starting-torque').innerText = startingTorque.toFixed(2);
        }

        

        // Responsive Scaling relative to original 700x700 mapping
        let minDim = p.min(p.width, p.height);
        let scaleFactor = (minDim - 40) / 700; // Adds a small padding margin constraint

        p.translate(p.width / 2, p.height / 2);
        p.scale(scaleFactor, -scaleFactor); // Responsive transformation

        let baseFrequency = document.getElementById("fBase").value;
        let omega = 2 * p.PI * baseFrequency;
        let maxRadius = 600;
        let statorWidth = 150;
        let statorWireRadius = 45;
        let statorWirePlacementRadius = (maxRadius - statorWidth / 2) / 2;

        p.fill(255); p.stroke(0); p.strokeWeight(4);
        p.ellipse(0, 0, maxRadius, maxRadius);
        p.fill(255); p.ellipse(0, 0, maxRadius - statorWidth, maxRadius - statorWidth);

        let phaseShiftA = 0; let phaseShiftB = p.radians(120); let phaseShiftC = p.radians(240);
        let statorMagneticField = new Complex(0, 0);
        let magnetizationMagneticField = new Complex(0, 0);
        let loadMagneticField = new Complex(0, 0);

        for (let i = 0; i < 3; i++) {
          let phaseShift;
          for (let j = 0; j < 2; j++) {
            switch (i) {
              case 0: phaseShift = phaseShiftA - j * p.PI; break;
              case 1: phaseShift = phaseShiftB - j * p.PI; break;
              case 2: phaseShift = phaseShiftC - j * p.PI; break;
            }
            let spatialAngle = p.radians(i * 120 + j * 180 - 90);
            let wx = p.cos(spatialAngle) * statorWirePlacementRadius;
            let wy = p.sin(spatialAngle) * statorWirePlacementRadius;

            let statorCurrentScaledVal = p.sin(omega * speedFactor - phaseShift + statorCurrent.arg());
            let magnetizationCurrentScaledVal = p.sin(omega * speedFactor - phaseShift + magnetizationCurrent.arg());
            let loadCurrentScaledVal = p.sin(omega * speedFactor - phaseShift + loadCurrent.arg());

            for (let k = 0; k < 3; k++) {
              switch (k) {
                case 0: statorMagneticField = statorMagneticField.add(new Complex(p.cos(spatialAngle + (statorCurrentScaledVal >= 0 ? 90 : -90)), p.sin(spatialAngle + (statorCurrentScaledVal >= 0 ? 90 : -90))).mul(p.abs(statorCurrentScaledVal))); break;
                case 1: magnetizationMagneticField = magnetizationMagneticField.add(new Complex(p.cos(spatialAngle + (magnetizationCurrentScaledVal >= 0 ? 90 : -90)), p.sin(spatialAngle + (magnetizationCurrentScaledVal >= 0 ? 90 : -90))).mul(p.abs(magnetizationCurrentScaledVal))); break;
                case 2: loadMagneticField = loadMagneticField.add(new Complex(p.cos(spatialAngle + (loadCurrentScaledVal >= 0 ? 90 : -90)), p.sin(spatialAngle + (loadCurrentScaledVal >= 0 ? 90 : -90))).mul(p.abs(loadCurrentScaledVal))); break;
              }
            }

            let maxSymbolSize = 20;
            let currentMagnitude = p.abs(statorCurrentScaledVal);
            let dynamicSize = maxSymbolSize * currentMagnitude;

            if (statorCurrentScaledVal >= 0) {
              p.fill(255); p.stroke(0); p.strokeWeight(3);
              p.ellipse(wx, wy, statorWireRadius, statorWireRadius);
              p.stroke(0); p.strokeWeight(2.5 * currentMagnitude);
              let halfSize = dynamicSize / 2;
              p.line(wx - halfSize, wy - halfSize, wx + halfSize, wy + halfSize);
              p.line(wx - halfSize, wy + halfSize, wx + halfSize, wy - halfSize);
            } else {
              p.fill(220); p.stroke(0); p.strokeWeight(3);
              p.ellipse(wx, wy, statorWireRadius, statorWireRadius);
              p.fill(0); p.noStroke();
              p.ellipse(wx, wy, dynamicSize, dynamicSize);
            }
          }
        }
        drawVisualLegend(p);
        statorMagneticField = safeDiv(statorMagneticField, statorMagneticField.abs()).mul(statorCurrent.abs());
        magnetizationMagneticField = safeDiv(magnetizationMagneticField, magnetizationMagneticField.abs()).mul(magnetizationCurrent.abs());
        loadMagneticField = safeDiv(loadMagneticField, loadMagneticField.abs()).mul(loadCurrent.abs());

        let rotorAngle = omega * speedFactor * (1 - slipVal);
        let rotorOmega = 2 * p.PI * baseFrequency * slipVal;
        let rotorDiam = 375;
        let rotorRad = rotorDiam / 2;
        let rotorWidth = 115;
        let barPlacementRadius = rotorRad - (rotorWidth / 4);
        let rotorWireRadius = 32;

        p.push();
        p.rotate(rotorAngle);
        p.fill(255); p.stroke(0); p.strokeWeight(4);
        p.ellipse(0, 0, rotorDiam, rotorDiam);
        p.fill(255); p.ellipse(0, 0, rotorDiam - 110, rotorDiam - 110);

        let BmInitialAngle = p.atan2(-p.cos(magnetizationCurrent.arg()), p.sin(magnetizationCurrent.arg()));
        let BmInitialAngleUnidirectional = BmInitialAngle < 0 ? BmInitialAngle + 2 * p.PI : BmInitialAngle;
        let rotorMagneticField = new Complex(0, 0);

        for (let i = 0; i < numRotorBars; i++) {
          let spatialAngle = p.radians(i * (360 / numRotorBars));
          let bx = p.cos(spatialAngle) * barPlacementRadius;
          let by = p.sin(spatialAngle) * barPlacementRadius;
          let rotorPowerFactorAngle = p.atan2(slipVal * X2, R2);
          let voltageInitialAngle = BmInitialAngleUnidirectional - spatialAngle + (slipVal / p.abs(slipVal)) * p.PI / 2;
          let currentInitialAngle = voltageInitialAngle - rotorPowerFactorAngle;
          let rotorCurrentVal = p.sin(rotorOmega * speedFactor + currentInitialAngle);
          let maxSymbolSize = 12;
          let dynamicSize = maxSymbolSize * p.abs(rotorCurrentVal);

          if (rotorCurrentVal < 0) {
            rotorMagneticField = rotorMagneticField.add(Complex(p.cos(spatialAngle + rotorAngle + 90), p.sin(spatialAngle + rotorAngle + 90)).mul(p.abs(rotorCurrentVal)));
            p.fill(255); p.stroke(0); p.strokeWeight(2);
            p.ellipse(bx, by, rotorWireRadius, rotorWireRadius);
            p.stroke(0); p.strokeWeight(2.5 * p.abs(rotorCurrentVal));
            let halfSize = dynamicSize / 2;
            p.line(bx - halfSize, by - halfSize, bx + halfSize, by + halfSize);
            p.line(bx - halfSize, by + halfSize, bx + halfSize, by - halfSize);
          } else {
            rotorMagneticField = rotorMagneticField.add(Complex(p.cos(spatialAngle + rotorAngle - 90), p.sin(spatialAngle + rotorAngle - 90)).mul(p.abs(rotorCurrentVal)));
            p.fill(220); p.stroke(0); p.strokeWeight(3);
            p.ellipse(bx, by, rotorWireRadius, rotorWireRadius);
            p.fill(0); p.noStroke();
            p.ellipse(bx, by, dynamicSize, dynamicSize);
          }
        }

        p.pop();
        rotorMagneticField = safeDiv(rotorMagneticField, rotorMagneticField.abs()).mul(loadCurrent.abs());

        for (let i = 0; i < 4; i++) {
          let magneticField;
          switch (i) {
            case 0: magneticField = statorMagneticField; break;
            case 1: magneticField = magnetizationMagneticField; break;
            case 2: magneticField = loadMagneticField; break;
            case 3: magneticField = rotorMagneticField; break;
          }
          let fieldAngle = magneticField.arg();
          let fieldX = p.cos(fieldAngle);
          let fieldY = p.sin(fieldAngle);
          let vectorScale = rotorRad - rotorWidth / 2;
          let ratio = safeDiv(new Complex(magneticField.abs(), 0), new Complex(statorMagneticField.abs(), 0)).re;
          let len = vectorScale * ratio;

          switch (i) {
            case 0: p.stroke(255, 0, 0); break;
            case 1: p.stroke(0, 255, 0); break;
            case 2: p.stroke(0, 0, 255); break;
            case 3: p.stroke(255, 0, 255); break;
          }
          p.strokeWeight(3);
          p.line(0, 0, fieldX * len, fieldY * len);

          p.push();
          p.translate(fieldX * len, fieldY * len);
          p.rotate(fieldAngle);
          let h = 8 * ratio;
          let w = 5 * ratio;
          p.line(0, 0, -h, -w);
          p.line(0, 0, -h, w);
          p.pop();

          if (i == 1) {
            dashLine(-fieldX * (rotorRad + 10), -fieldY * (rotorRad + 10), fieldX * (rotorRad + 10), fieldY * (rotorRad + 10), 5, 20, p.color(0, 255, 0), p);
            p.push();
            p.fill(0, 255, 0);
            p.strokeWeight(0);
            p.scale(1, -1);
            p.textSize(16);
            p.text("Max induced voltage", fieldX * (rotorRad + 10), -fieldY * (rotorRad + 10));
            p.pop();

            let currentMaxAngle = fieldAngle - p.atan2(slipVal * X2, R2);
            let currentFieldX = p.cos(currentMaxAngle);
            let currentFieldY = p.sin(currentMaxAngle);
            dashLine(-currentFieldX * (rotorRad + 10), -currentFieldY * (rotorRad + 10), currentFieldX * (rotorRad + 10), currentFieldY * (rotorRad + 10), 6, 20, "#8931EF", p);
            p.push();
            p.fill("#8931EF");
            p.strokeWeight(0);
            p.scale(1, -1);
            p.textSize(16);
            p.text("Max induced current", currentFieldX * (rotorRad + 10) + 15, -currentFieldY * (rotorRad + 10) + 15);
            p.pop();
          }
        }
      };
    };

    const genSketch = (p) => {
      let container;
      p.setup = () => {
        container = document.getElementById('gen-container');
        p.createCanvas(container.clientWidth, container.clientHeight).parent('gen-container');
      };

      p.draw = () => {
        // Responsive Canvas Resize Check
        if (p.width !== container.clientWidth || p.height !== container.clientHeight) {
          if (container.clientWidth > 0 && container.clientHeight > 0) {
            p.resizeCanvas(container.clientWidth, container.clientHeight);
          }
        }

        let validationErrors = validateSimulationInputs('standalone');
        updateErrorOverlay(validationErrors, 'gen-container');

        if (validationErrors.length > 0) {
          p.background(245);
          p.fill(150); p.noStroke(); p.textAlign(p.CENTER, p.CENTER); p.textSize(14);
          p.text("Simulation suspended due to parameter errors.", p.width / 2, p.height / 2);
          return;
        }

        if (document.body.classList.contains('mode-standalone')) {
          updateSimulationClock(p);
        }

        p.background(255);

        let R1 = parseFloat(document.getElementById('R1Input').value);
        let RL = parseFloat(document.getElementById('RLInput').value);
        let C = parseFloat(document.getElementById('CInput').value) * 1e-6;
        let R2 = parseFloat(document.getElementById('R2Input').value);
        let X2Base = parseFloat(document.getElementById('X2Input').value);
        let X1Base = parseFloat(document.getElementById('X1Input').value);
        let baseFreq = 60;
        let XcBase = 1 / (2 * p.PI * baseFreq * C);
        let XLBase = parseFloat(document.getElementById('XLInput').value);
        let fi = parseFloat(document.getElementById('fi').value);
        let baseFrequency = document.getElementById("fBase").value;
        let Rc = parseFloat(document.getElementById('RcInput').value);
        let numRotorBars = parseInt(document.getElementById('barSlider').value);

        const playMode = document.getElementById('playbackMode')?.value || 'auto';
        let speedFactor = playMode === 'manual' ? parseFloat(document.getElementById('speedSlider').value) : simTime;

        let f = solveForF(R1, X1Base, R2, X2Base, Rc, XcBase, RL, XLBase, fi, baseFrequency);

        if (typeof f !== 'number') {
          p.push();
          p.resetMatrix();
          p.fill(0); p.noStroke(); p.textSize(16);
          p.text("Generator not working! No Self-Excitation.", 20, 150);
          p.pop();
          if (document.body.classList.contains('mode-standalone')) {
            document.getElementById('res-gen-f').innerText = "--";
            document.getElementById('res-gen-xm').innerText = "--";
          }
          return;
        }

        let XmBase = solveForXm(f, R1, X1Base, R2, X2Base, XcBase, RL, XLBase, fi, baseFrequency);
        if (XmBase < 0) {
          if (document.body.classList.contains('mode-standalone')) {
            document.getElementById('error').style.display = 'block';
          }
        } else {
          if (document.body.classList.contains('mode-standalone')) {
            document.getElementById('error').style.display = 'none';
          }
        }

        let X1 = X1Base * f / baseFrequency;
        let X2 = X2Base * f / baseFrequency;
        let Xc = XcBase * f / baseFrequency;
        let Xm = XmBase * f / baseFrequency;
        let slipVal = (f - fi) / (f === 0 ? 1e-5 : f);
        let XL = XLBase * f / baseFrequency;

        let omega = 2 * p.PI * f;

        let Z_R2_X2 = new Complex(R2 / (slipVal === 0 ? 1e-5 : slipVal), X2);
        let Z_Xm = new Complex(0, Xm);
        let Z_R1_X1 = new Complex(R1, X1);
        let Z_load = new Complex(RL, XL);
        let Z_ex = new Complex(0, -Xc);

        let statorTheveninImpedance = Z_R1_X1.add(safeInverse(safeInverse(Z_load).add(safeInverse(Z_ex))));
        let statorCurrent = safeInverse(statorTheveninImpedance).mul(-1);
        let magnetizationCurrent = safeInverse(Z_Xm);
        let loadCurrent = safeInverse(Z_R2_X2);

        if (document.body.classList.contains('mode-standalone')) {
          document.getElementById('res-gen-f').innerText = f.toFixed(2);
          document.getElementById('res-gen-xm').innerText = Xm.toFixed(2);
        }

        

        // Responsive Scaling 
        let minDim = p.min(p.width, p.height);
        let scaleFactor = (minDim - 40) / 700;

        p.translate(p.width / 2, p.height / 2);
        p.scale(scaleFactor, -scaleFactor);

        let maxRadius = 600;
        let statorWidth = 150;
        let statorWireRadius = 45;
        p.fill(255); p.stroke(0); p.strokeWeight(4);
        p.ellipse(0, 0, maxRadius, maxRadius);
        p.fill(255); p.ellipse(0, 0, maxRadius - statorWidth, maxRadius - statorWidth);

        let statorWirePlacementRadius = (maxRadius - statorWidth / 2) / 2;
        let phaseShiftA = 0; let phaseShiftB = p.radians(120); let phaseShiftC = p.radians(240);

        let statorMagneticField = new Complex(0, 0);
        let magnetizationMagneticField = new Complex(0, 0);
        let loadMagneticField = new Complex(0, 0);

        for (let i = 0; i < 3; i++) {
          let phaseShift;
          for (let j = 0; j < 2; j++) {
            switch (i) {
              case 0: phaseShift = phaseShiftA - j * p.PI; break;
              case 1: phaseShift = phaseShiftB - j * p.PI; break;
              case 2: phaseShift = phaseShiftC - j * p.PI; break;
            }

            let spatialAngle = p.radians(i * 120 + j * 180 - 90);
            let wx = p.cos(spatialAngle) * statorWirePlacementRadius;
            let wy = p.sin(spatialAngle) * statorWirePlacementRadius;

            let statorCurrentScaledVal = p.sin(omega * speedFactor - phaseShift + statorCurrent.arg());
            let magnetizationCurrentScaledVal = p.sin(omega * speedFactor - phaseShift + magnetizationCurrent.arg());
            let loadCurrentScaledVal = p.sin(omega * speedFactor - phaseShift + loadCurrent.arg());

            for (let k = 0; k < 3; k++) {
              switch (k) {
                case 0: statorMagneticField = statorMagneticField.add(new Complex(p.cos(spatialAngle + (statorCurrentScaledVal >= 0 ? 90 : -90)), p.sin(spatialAngle + (statorCurrentScaledVal >= 0 ? 90 : -90))).mul(p.abs(statorCurrentScaledVal))); break;
                case 1: magnetizationMagneticField = magnetizationMagneticField.add(new Complex(p.cos(spatialAngle + (magnetizationCurrentScaledVal >= 0 ? 90 : -90)), p.sin(spatialAngle + (magnetizationCurrentScaledVal >= 0 ? 90 : -90))).mul(p.abs(magnetizationCurrentScaledVal))); break;
                case 2: loadMagneticField = loadMagneticField.add(new Complex(p.cos(spatialAngle + (loadCurrentScaledVal >= 0 ? 90 : -90)), p.sin(spatialAngle + (loadCurrentScaledVal >= 0 ? 90 : -90))).mul(p.abs(loadCurrentScaledVal))); break;
              }
            }

            let maxSymbolSize = 12;
            let currentMagnitude = p.abs(statorCurrentScaledVal);
            let dynamicSize = maxSymbolSize * currentMagnitude;

            if (statorCurrentScaledVal >= 0) {
              p.fill(255); p.stroke(0); p.strokeWeight(3);
              p.ellipse(wx, wy, statorWireRadius, statorWireRadius);
              p.stroke(0); p.strokeWeight(2.5 * currentMagnitude);
              let halfSize = dynamicSize / 2;
              p.line(wx - halfSize, wy - halfSize, wx + halfSize, wy + halfSize);
              p.line(wx - halfSize, wy + halfSize, wx + halfSize, wy - halfSize);
            } else {
              p.fill(220); p.stroke(0); p.strokeWeight(3);
              p.ellipse(wx, wy, statorWireRadius, statorWireRadius);
              p.fill(0); p.noStroke();
              p.ellipse(wx, wy, dynamicSize, dynamicSize);
            }
          }
        }
        drawVisualLegend(p);
        statorMagneticField = safeDiv(statorMagneticField, statorMagneticField.abs()).mul(statorCurrent.abs());
        magnetizationMagneticField = safeDiv(magnetizationMagneticField, magnetizationMagneticField.abs()).mul(magnetizationCurrent.abs());
        loadMagneticField = safeDiv(loadMagneticField, loadMagneticField.abs()).mul(loadCurrent.abs());

        let rotorAngle = omega * speedFactor * (1 - slipVal);
        let rotorOmega = omega * slipVal;
        let rotorDiam = 375;
        let rotorRad = rotorDiam / 2;
        let rotorWidth = 115;
        let barPlacementRadius = rotorRad - (rotorWidth / 4);
        let rotorWireRadius = 32;

        p.push();
        p.rotate(rotorAngle);
        p.fill(255); p.stroke(0); p.strokeWeight(4);
        p.ellipse(0, 0, rotorDiam, rotorDiam);
        p.fill(255); p.ellipse(0, 0, rotorDiam - rotorWidth, rotorDiam - rotorWidth);

        let BmInitialAngle = p.atan2(-p.cos(magnetizationCurrent.arg()), p.sin(magnetizationCurrent.arg()));
        let BmInitialAngleUnidirectional = BmInitialAngle < 0 ? BmInitialAngle + 2 * p.PI : BmInitialAngle;
        let rotorMagneticField = new Complex(0, 0);

        for (let i = 0; i < numRotorBars; i++) {
          let spatialAngle = p.radians(i * (360 / numRotorBars));
          let bx = p.cos(spatialAngle) * barPlacementRadius;
          let by = p.sin(spatialAngle) * barPlacementRadius;
          let rotorPowerFactorAngle = p.atan2(slipVal * X2, R2);
          let voltageInitialAngle = BmInitialAngleUnidirectional - spatialAngle + (slipVal / (Math.abs(slipVal) < 1e-5 ? 1e-5 : p.abs(slipVal))) * p.PI / 2;
          let currentInitialAngle = voltageInitialAngle - rotorPowerFactorAngle;
          let rotorCurrentVal = p.sin(rotorOmega * speedFactor + currentInitialAngle);
          let maxSymbolSize = 12;
          let dynamicSize = maxSymbolSize * p.abs(rotorCurrentVal);
          if (rotorCurrentVal < 0) {
            rotorMagneticField = rotorMagneticField.add(Complex(p.cos(spatialAngle + rotorAngle + 90), p.sin(spatialAngle + rotorAngle + 90)).mul(p.abs(rotorCurrentVal)));
            p.fill(255); p.stroke(0); p.strokeWeight(2);
            p.ellipse(bx, by, rotorWireRadius, rotorWireRadius);
            p.stroke(0); p.strokeWeight(2.5 * p.abs(rotorCurrentVal));
            let halfSize = dynamicSize / 2;
            p.line(bx - halfSize, by - halfSize, bx + halfSize, by + halfSize);
            p.line(bx - halfSize, by + halfSize, bx + halfSize, by - halfSize);
          } else {
            rotorMagneticField = rotorMagneticField.add(Complex(p.cos(spatialAngle + rotorAngle - 90), p.sin(spatialAngle + rotorAngle - 90)).mul(p.abs(rotorCurrentVal)));
            p.fill(220); p.stroke(0); p.strokeWeight(3);
            p.ellipse(bx, by, rotorWireRadius, rotorWireRadius);
            p.fill(0); p.noStroke();
            p.ellipse(bx, by, dynamicSize, dynamicSize);
          }
        }

        p.pop();
        rotorMagneticField = safeDiv(rotorMagneticField, rotorMagneticField.abs()).mul(loadCurrent.abs());

        for (let i = 0; i < 4; i++) {
          let magneticField
          switch (i) {
            case 0: magneticField = statorMagneticField; break;
            case 1: magneticField = magnetizationMagneticField; break;
            case 2: magneticField = loadMagneticField; break;
            case 3: magneticField = rotorMagneticField; break;
          }
          let fieldAngle = magneticField.arg();
          let fieldX = p.cos(fieldAngle);
          let fieldY = p.sin(fieldAngle);
          let vectorScale = rotorRad - (rotorWidth / 2);
          let ratio = safeDiv(new Complex(magneticField.abs(), 0), new Complex(statorMagneticField.abs(), 0)).re;
          let len = vectorScale * ratio;

          switch (i) {
            case 0: p.stroke(255, 0, 0); break;
            case 1: p.stroke(0, 255, 0); break;
            case 2: p.stroke(0, 0, 255); break;
            case 3: p.stroke(255, 0, 255); break;
          }

          p.strokeWeight(p.constrain(3 * ratio, 1, 3));
          p.line(0, 0, fieldX * len, fieldY * len);

          p.push();
          p.translate(fieldX * len, fieldY * len);
          p.rotate(fieldAngle);
          let h = 8 * ratio;
          let w = 5 * ratio;
          p.line(0, 0, -h, -w);
          p.line(0, 0, -h, w);
          p.pop();

          if (i == 1) {
            p.push();
            dashLine(-fieldX * (rotorRad + 10), -fieldY * (rotorRad + 10), fieldX * (rotorRad + 10), fieldY * (rotorRad + 10), 5, 20, p.color(0, 255, 0), p);
            p.fill(0, 255, 0);
            p.strokeWeight(0);
            p.scale(1, -1);
            p.textSize(16);
            p.text("Max induced voltage", fieldX * (rotorRad + 10), -fieldY * (rotorRad + 10));
            p.pop();

            let currentMaxAngle = fieldAngle - p.atan2(slipVal * X2, R2);
            let currentFieldX = p.cos(currentMaxAngle);
            let currentFieldY = p.sin(currentMaxAngle);

            p.push();
            dashLine(-currentFieldX * (rotorRad + 10), -currentFieldY * (rotorRad + 10), currentFieldX * (rotorRad + 10), currentFieldY * (rotorRad + 10), 5, 20, "#8931EF", p);
            p.fill("#8931EF");
            p.strokeWeight(0);
            p.scale(1, -1);
            p.textSize(16);
            p.text("Max induced current", currentFieldX * (rotorRad + 10) + 15, -currentFieldY * (rotorRad + 10) + 15);
            p.pop();
          }
        }
      };
    };

    new p5(genSketch);
    new p5(motorSketch);