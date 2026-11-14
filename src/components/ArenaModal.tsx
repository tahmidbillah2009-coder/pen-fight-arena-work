import React from 'react';
import { Check, Compass, Lock } from 'lucide-react';
import { PHYSICS_BALANCE } from '../utils/Constants';
import { PaperDivider, PaperModalShell, PaperSectionLabel } from './PaperUI';

interface ArenaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArenaModal: React.FC<ArenaModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <PaperModalShell
      title="Arena Selection"
      subtitle="Tabletop surfaces & boundary geometry"
      icon={<Compass className="h-4 w-4" />}
      onClose={onClose}
      maxWidthClass="max-w-xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-[#6E6A64]">
            Active surface: <strong className="text-[#292725]">Classroom Wooden Desk</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="paper-btn min-h-[40px] rounded-lg border-[1.5px] border-[#45413C] bg-[#4F6D8A] px-5 text-xs font-bold uppercase tracking-[0.06em] text-[#FFFDF8] hover:bg-[#435E79]"
          >
            Done
          </button>
        </div>
      }
    >
      <div className="space-y-4 p-4 sm:p-6">
        {/* Active Arena Card */}
        <div className="paper-shadow-sm overflow-hidden rounded-xl border-[1.5px] border-[#45413C] bg-[#FFFDF8]">
          <div className="paper-dots-inset flex items-center justify-between border-b border-[#D9C5A8] px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-extrabold uppercase tracking-[0.03em] text-[#292725]">
                  Classroom Wooden Desk
                </h3>
                <span className="inline-flex items-center gap-1 rounded border border-[#2E664B] bg-[#E6F2EC] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#2E664B]">
                  <Check className="h-3 w-3" />
                  Active
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[#6E6A64]">
                Varnished beechwood tabletop with inlaid ruler ticks &amp; chalkboard backdrop
              </p>
            </div>
          </div>

          {/* Schematic Tabletop Illustration */}
          <div className="p-4">
            <div className="paper-dots flex items-center justify-center rounded-lg border border-[#D9C5A8] p-4">
              <svg viewBox="0 0 320 150" className="h-32 w-full max-w-[290px]" aria-hidden="true">
                {/* Desk shadow */}
                <rect x="26" y="24" width="276" height="108" rx="6" fill="#D9C5A8" />
                {/* Desk surface */}
                <rect
                  x="20"
                  y="18"
                  width="276"
                  height="108"
                  rx="6"
                  fill="#E8CFA8"
                  stroke="#45413C"
                  strokeWidth="2.2"
                />
                {/* Inner engraved border */}
                <rect
                  x="30"
                  y="28"
                  width="256"
                  height="88"
                  rx="3"
                  fill="none"
                  stroke="#9C7F58"
                  strokeWidth="1.2"
                />
                {/* Center dashed line */}
                <line
                  x1="158"
                  y1="28"
                  x2="158"
                  y2="116"
                  stroke="#8A6E4B"
                  strokeWidth="1.5"
                  strokeDasharray="5 4"
                />
                {/* Ruler ticks along bottom */}
                {Array.from({ length: 13 }).map((_, idx) => {
                  const x = 38 + idx * 20;
                  return (
                    <line
                      key={idx}
                      x1={x}
                      y1="110"
                      x2={x}
                      y2={idx % 2 === 0 ? '116' : '113'}
                      stroke="#785E3D"
                      strokeWidth="1.2"
                    />
                  );
                })}
                {/* Blue pen */}
                <g transform="rotate(-12 88 72)">
                  <rect x="64" y="68" width="46" height="8" rx="2" fill="#4F6D8A" stroke="#292725" strokeWidth="1.4" />
                  <polygon points="110,68 119,72 110,76" fill="#FFFDF8" stroke="#292725" strokeWidth="1.2" />
                </g>
                {/* Red pen */}
                <g transform="rotate(165 228 72)">
                  <rect x="204" y="68" width="46" height="8" rx="2" fill="#B55450" stroke="#292725" strokeWidth="1.4" />
                  <polygon points="250,68 259,72 250,76" fill="#D9C5A8" stroke="#292725" strokeWidth="1.2" />
                </g>
              </svg>
            </div>

            {/* Physics Readout */}
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-[#D9C5A8] bg-[#F7F3EA] px-2.5 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#6E6A64]">
                  Dimensions
                </div>
                <div className="font-mono-num mt-0.5 text-xs font-bold text-[#292725]">
                  {PHYSICS_BALANCE.arenaWidth} × {PHYSICS_BALANCE.arenaDepth} u
                </div>
              </div>
              <div className="rounded-lg border border-[#D9C5A8] bg-[#F7F3EA] px-2.5 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#6E6A64]">
                  Surface Friction
                </div>
                <div className="font-mono-num mt-0.5 text-xs font-bold text-[#292725]">
                  {PHYSICS_BALANCE.surfaceFriction.toFixed(2)} μ
                </div>
              </div>
              <div className="rounded-lg border border-[#D9C5A8] bg-[#F7F3EA] px-2.5 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#6E6A64]">
                  Bounce
                </div>
                <div className="font-mono-num mt-0.5 text-xs font-bold text-[#292725]">
                  {PHYSICS_BALANCE.tableRestitution.toFixed(2)} e
                </div>
              </div>
            </div>
          </div>
        </div>

        <PaperDivider />

        {/* Future Desk Themes (honestly marked upcoming) */}
        <div className="space-y-2">
          <PaperSectionLabel right="Planned Editions">Additional Arenas</PaperSectionLabel>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {[
              {
                name: 'Drafting Studio Board',
                desc: 'Smooth matte cutting-mat surface with crisp millimeter grid rules.',
              },
              {
                name: 'Library Oak Desk',
                desc: 'Polished walnut reading table with brass corner trims.',
              },
            ].map((item) => (
              <div
                key={item.name}
                className="rounded-xl border border-[#D4CBB9] bg-[#F7F3EA] p-3.5 opacity-80"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#292725]">{item.name}</span>
                  <span className="inline-flex items-center gap-1 rounded border border-[#8D8579] bg-[#EFEAE0] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#6E6A64]">
                    <Lock className="h-2.5 w-2.5" />
                    Coming Soon
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-[#6E6A64]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PaperModalShell>
  );
};
