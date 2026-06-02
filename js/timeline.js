import { fmtTime, todayStr } from './utils.js';

export const MIN_START = 8 * 60;   // 480 (08:00)
export const MIN_END   = 24 * 60;  // 1440 (24:00)
export const RANGE     = MIN_END - MIN_START; // 960

export function timeToMin(tStr) {
  if (!tStr) return 0;
  const [h, m] = tStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minToTime(min) {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function snapTo15(min) {
  return Math.round(min / 15) * 15;
}

export function fmtDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

/**
 * Render the entire Gantt-style timeline grid into a container.
 * @param {HTMLElement} container - The DOM element to render into.
 * @param {Object} options - Configuration options.
 */
export function renderTimelineGrid(container, options) {
  const {
    date, // "yyyy-mm-dd"
    rigs, // Array of rig objects
    bookingsMap, // Object: rigId -> [bookings]
    onSelect, // (rigId, startMin, endMin) => void
    onBookingClick, // (booking) => void
    selection, // { rigId, start, end }
    mode // 'customer' or 'admin' or 'walkin'
  } = options;

  container.innerHTML = '';
  
  const wrap = document.createElement('div');
  wrap.className = 'timeline-wrapper';
  
  const grid = document.createElement('div');
  grid.className = 'timeline-grid-new';
  
  // -- Ruler Header --
  const headerRow = document.createElement('div');
  headerRow.className = 'timeline-header-row-new';
  
  const corner = document.createElement('div');
  corner.className = 'timeline-row-label-new sticky-col header-corner';
  corner.innerHTML = `<span>Rig / Time</span>`;
  headerRow.appendChild(corner);
  
  const trackHeader = document.createElement('div');
  trackHeader.className = 'timeline-ruler-track';
  // Create ticks
  for (let h = 8; h <= 24; h++) {
    const min = h * 60;
    const pct = ((min - MIN_START) / RANGE) * 100;
    if (pct >= 0 && pct <= 100) {
      const tick = document.createElement('div');
      tick.className = 'ruler-tick';
      tick.style.left = `${pct}%`;
      const ampm = h === 24 ? 'AM' : h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      tick.innerHTML = `<span>${h12}${ampm.toLowerCase()}</span>`;
      trackHeader.appendChild(tick);
    }
  }
  headerRow.appendChild(trackHeader);
  grid.appendChild(headerRow);
  
  const isToday = date === todayStr();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // -- Tooltip --
  let tooltipEl = document.getElementById('timeline-tooltip');
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'timeline-tooltip';
    tooltipEl.className = 'timeline-tooltip hidden';
    document.body.appendChild(tooltipEl);
  }

  // -- Rig Rows --
  rigs.forEach(rig => {
    const row = document.createElement('div');
    row.className = 'timeline-row-new';
    
    // Label
    const label = document.createElement('div');
    label.className = 'timeline-row-label-new sticky-col';
    label.innerHTML = `
      <div style="line-height:1.2">
        <strong style="font-size:0.8rem;text-transform:uppercase">${rig.name}</strong><br>
        <span style="font-size:0.65rem;color:var(--muted)">${rig.type}</span>
      </div>
      ${rig.status === 'maintenance' ? '<span class="badge badge-red" style="margin-left:auto;font-size:0.5rem;padding:0.1rem 0.3rem">MAINT</span>' : ''}
    `;
    row.appendChild(label);
    
    // Track
    const trackWrap = document.createElement('div');
    trackWrap.className = 'timeline-track-wrap';
    if (rig.status === 'maintenance') trackWrap.classList.add('is-maintenance');
    
    const bookedSlots = bookingsMap[rig.id] || [];
    
    // 1. Maintenance background
    if (rig.status === 'maintenance') {
      const maintBg = document.createElement('div');
      maintBg.className = 'timeline-block maint-bg';
      maintBg.style.left = '0%'; maintBg.style.width = '100%';
      trackWrap.appendChild(maintBg);
    }
    
    // 2. Past time hatch (if today)
    if (isToday && nowMin > MIN_START && rig.status !== 'maintenance') {
      const clampedNow = Math.min(nowMin, MIN_END);
      const pastBg = document.createElement('div');
      pastBg.className = 'timeline-block past-bg';
      pastBg.style.left = '0%';
      pastBg.style.width = `${((clampedNow - MIN_START) / RANGE) * 100}%`;
      trackWrap.appendChild(pastBg);
    }
    
    // 3. Render booked blocks
    if (rig.status !== 'maintenance') {
      bookedSlots.forEach(b => {
        const s = timeToMin(b.start_time);
        const e = timeToMin(b.end_time);
        const left = ((s - MIN_START) / RANGE) * 100;
        const width = ((e - s) / RANGE) * 100;
        
        const block = document.createElement('div');
        block.className = `timeline-block booked-block ${b.notes ? 'walk-in' : ''}`;
        block.style.left = `${left}%`;
        block.style.width = `${width}%`;
        
        const name = b.notes ? `[WI] ${b.notes}` : (b.profiles?.name || 'Customer');
        block.innerHTML = `<span>${name}</span>`;
        
        if (onBookingClick && mode === 'admin') {
          block.onclick = (ev) => { ev.stopPropagation(); onBookingClick(b, rig); };
        }
        trackWrap.appendChild(block);
      });
    }

    // 4. Selection (if any)
    let selStart = null;
    let selEnd = null;
    if (selection && selection.rigId === rig.id) {
      selStart = selection.start;
      selEnd = selection.end;
      
      const left = ((selStart - MIN_START) / RANGE) * 100;
      const width = ((selEnd - selStart) / RANGE) * 100;
      
      const selBlock = document.createElement('div');
      selBlock.className = 'timeline-block selection-block';
      selBlock.style.left = `${left}%`;
      selBlock.style.width = `${width}%`;
      
      const dur = fmtDuration(selEnd - selStart);
      selBlock.innerHTML = `
        <div class="sel-label">
          <span>${fmtTime(minToTime(selStart))} → ${fmtTime(minToTime(selEnd))}</span>
          <span class="sel-dur">${dur}</span>
        </div>
      `;
      trackWrap.appendChild(selBlock);
    }

    // 5. Current Time Line
    if (isToday && nowMin >= MIN_START && nowMin <= MIN_END) {
      const nowPct = ((nowMin - MIN_START) / RANGE) * 100;
      const nowLine = document.createElement('div');
      nowLine.className = 'timeline-now-line';
      nowLine.style.left = `${nowPct}%`;
      nowLine.innerHTML = `<div class="timeline-now-dot"></div>`;
      trackWrap.appendChild(nowLine);
    }

    // -- Interaction logic --
    if (rig.status !== 'maintenance' && onSelect) {
      let isDragging = false;
      let dragAnchor = null;
      let activeSel = null; // {start, end}

      const getMinFromX = (clientX) => {
        const rect = trackWrap.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return snapTo15(MIN_START + ratio * RANGE);
      };

      const isMinBlocked = (min) => {
        if (isToday && min < nowMin) return true;
        return bookedSlots.some(b => {
          const s = timeToMin(b.start_time);
          const e = timeToMin(b.end_time);
          return min >= s && min < e;
        });
      };

      const clampSelection = (start, end) => {
        let maxStart = start;
        let maxEnd = end;
        
        // Find nearest boundaries inside the range
        // If dragging right, we hit a start_time
        if (start === dragAnchor) {
          // Dragging right
          const obstacle = bookedSlots.find(b => {
            const s = timeToMin(b.start_time);
            return s >= dragAnchor && s < end;
          });
          if (obstacle) maxEnd = timeToMin(obstacle.start_time);
        } else {
          // Dragging left
          const obstacle = bookedSlots.find(b => {
            const e = timeToMin(b.end_time);
            return e <= dragAnchor && e > start;
          });
          if (obstacle) maxStart = timeToMin(obstacle.end_time);
          
          if (isToday) {
            const pastMin = snapTo15(nowMin);
            if (maxStart < pastMin && dragAnchor >= pastMin) {
              maxStart = pastMin;
            }
          }
        }
        return { start: maxStart, end: maxEnd };
      };

      const handleDown = (e) => {
        // Only left clicks
        if (e.type === 'mousedown' && e.button !== 0) return;
        
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const min = getMinFromX(clientX);
        
        if (isMinBlocked(min)) return;
        
        isDragging = true;
        dragAnchor = min;
        activeSel = { start: min, end: min };
        
        // Use a temporary block while dragging
        const tempBlock = document.createElement('div');
        tempBlock.className = 'timeline-block temp-selection';
        tempBlock.id = 'temp-drag-block';
        tempBlock.style.left = `${((min - MIN_START)/RANGE)*100}%`;
        tempBlock.style.width = '0%';
        trackWrap.appendChild(tempBlock);
        
        if (e.type === 'mousedown') e.preventDefault();
      };

      const handleMove = (e) => {
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const curMin = getMinFromX(clientX);
        
        // Tooltip
        tooltipEl.textContent = fmtTime(minToTime(curMin));
        tooltipEl.style.left = `${clientX + 10}px`;
        tooltipEl.style.top = `${(e.clientY || (e.touches && e.touches[0].clientY)) + 15}px`;
        tooltipEl.classList.remove('hidden');

        if (!isDragging) return;
        
        const start = Math.min(dragAnchor, curMin);
        const end = Math.max(dragAnchor, curMin);
        
        activeSel = clampSelection(start, end);
        
        const tempBlock = document.getElementById('temp-drag-block');
        if (tempBlock) {
          tempBlock.style.left = `${((activeSel.start - MIN_START)/RANGE)*100}%`;
          tempBlock.style.width = `${((activeSel.end - activeSel.start)/RANGE)*100}%`;
        }
      };

      const handleUp = () => {
        if (!isDragging) return;
        isDragging = false;
        
        const tempBlock = document.getElementById('temp-drag-block');
        if (tempBlock) tempBlock.remove();
        
        if (activeSel && activeSel.end - activeSel.start >= 30) {
          onSelect(rig.id, activeSel.start, activeSel.end);
        } else {
          // If less than 30 mins, just cancel or clear selection for this rig if we had one
          if (selection && selection.rigId === rig.id) {
            onSelect(null, 0, 0); // clear
          }
        }
      };

      const handleLeave = () => {
        tooltipEl.classList.add('hidden');
        if (isDragging) handleUp();
      };

      trackWrap.addEventListener('mousedown', handleDown);
      trackWrap.addEventListener('mousemove', handleMove);
      trackWrap.addEventListener('mouseleave', handleLeave);
      window.addEventListener('mouseup', (e) => {
        if (isDragging) handleUp();
      });

      // Touch support
      trackWrap.addEventListener('touchstart', handleDown, {passive: true});
      trackWrap.addEventListener('touchmove', handleMove, {passive: true});
      trackWrap.addEventListener('touchend', handleUp);
      trackWrap.addEventListener('touchcancel', handleLeave);
    }

    row.appendChild(trackWrap);
    grid.appendChild(row);
  });

  wrap.appendChild(grid);
  container.appendChild(wrap);
}
