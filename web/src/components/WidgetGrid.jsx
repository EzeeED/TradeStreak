// Cuadrícula de widgets reordenable (arrastrar y soltar) y redimensionable.
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { EyeOff, GripVertical, Plus } from 'lucide-react';
import { cx } from './ui.jsx';

// Clases literales para que Tailwind las genere.
const SPAN_CLASS = { 4: 'lg:col-span-4', 6: 'lg:col-span-6', 8: 'lg:col-span-8', 12: 'lg:col-span-12' };
const SIZES = [
  { span: 4, label: '⅓', title: 'Un tercio' },
  { span: 6, label: '½', title: 'Mitad' },
  { span: 8, label: '⅔', title: 'Dos tercios' },
  { span: 12, label: 'Todo', title: 'Ancho completo' },
];

function SortableWidget({ item, title, editing, onResize, onHide, children }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !editing });
  const style = { transform: CSS.Translate.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cx('@container relative col-span-12 min-w-0', SPAN_CLASS[item.span], isDragging && 'z-20')}
    >
      {editing && (
        <div className={cx('mb-2 flex items-center gap-2 rounded-xl border border-crimson-500/40 bg-crimson-950/60 px-2 py-1.5 backdrop-blur', isDragging && 'shadow-2xl shadow-crimson-950')}>
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="touch-none cursor-grab rounded-lg p-1.5 text-crimson-300 hover:bg-crimson-600/20 active:cursor-grabbing"
            aria-label={`Mover ${title}`}
          >
            <GripVertical size={18} />
          </button>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
          <div className="hidden overflow-hidden rounded-lg border border-white/10 lg:flex" role="group" aria-label={`Tamaño de ${title}`}>
            {SIZES.map((s) => (
              <button
                key={s.span}
                type="button"
                title={s.title}
                aria-pressed={item.span === s.span}
                onClick={() => onResize(item.id, s.span)}
                className={cx('px-2.5 py-1 text-xs font-medium transition', item.span === s.span ? 'bg-crimson-600 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white')}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => onHide(item.id)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white" aria-label={`Ocultar ${title}`} title="Ocultar">
            <EyeOff size={16} />
          </button>
        </div>
      )}
      <div className={cx('h-full', editing && 'pointer-events-none select-none rounded-2xl opacity-80 outline-1 outline-dashed outline-offset-4 outline-crimson-500/40')} aria-hidden={editing || undefined}>
        {children}
      </div>
    </div>
  );
}

/**
 * layout: [{ id, span, hidden }]
 * widgets: { [id]: { title, render: () => node } }
 */
export default function WidgetGrid({ layout, onChange, widgets, editing }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const visible = layout.filter((w) => !w.hidden && widgets[w.id]);
  const hidden = layout.filter((w) => w.hidden && widgets[w.id]);

  const update = (id, patch) => onChange(layout.map((w) => (w.id === id ? { ...w, ...patch } : w)));

  function onDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    const from = layout.findIndex((w) => w.id === active.id);
    const to = layout.findIndex((w) => w.id === over.id);
    onChange(arrayMove(layout, from, to));
  }

  return (
    <div className="space-y-4">
      {editing && hidden.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-3">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted">Widgets ocultos</span>
          {hidden.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => update(w.id, { hidden: false })}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-panel-2 px-3 py-1 text-sm text-zinc-200 hover:border-crimson-500/50"
            >
              <Plus size={14} />{widgets[w.id].title}
            </button>
          ))}
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={visible.map((w) => w.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-12 items-stretch gap-6">
            {visible.map((item) => (
              <SortableWidget
                key={item.id}
                item={item}
                title={widgets[item.id].title}
                editing={editing}
                onResize={(id, span) => update(id, { span })}
                onHide={(id) => update(id, { hidden: true })}
              >
                {widgets[item.id].render()}
              </SortableWidget>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

/** Une el diseño guardado con el predeterminado: conserva orden/tamaños y añade widgets nuevos. */
export function mergeLayout(saved, defaults) {
  if (!Array.isArray(saved)) return defaults;
  const known = new Set(defaults.map((d) => d.id));
  const kept = saved.filter((w) => known.has(w.id));
  const keptIds = new Set(kept.map((w) => w.id));
  return [...kept, ...defaults.filter((d) => !keptIds.has(d.id))];
}
