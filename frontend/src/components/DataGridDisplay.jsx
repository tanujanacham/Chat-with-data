import React, { useMemo } from 'react';
import 'react-data-grid/lib/styles.css';
import { DataGrid } from 'react-data-grid';

export default function DataGridDisplay({ data }) {
  const columns = useMemo(() => {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]).map((key) => ({
      key,
      name: key,
      resizable: true,
      sortable: true,
      headerCellClass: 'bg-slate-50/80 backdrop-blur-sm text-slate-700 font-semibold text-xs tracking-wider uppercase border-b border-slate-200/60',
    }));
  }, [data]);

  if (!data || data.length === 0) {
    return <div className="p-8 text-center text-slate-500 text-sm">No data available</div>;
  }

  // Define row styling dynamically
  const rowKeyGetter = (row, index) => index;

  return (
    <div className="h-full w-full bg-transparent overflow-hidden rounded-b-3xl -mt-[1px]">
      <style>{`
        .rdg {
          --rdg-color: #334155;
          --rdg-border-color: #e2e8f0;
          --rdg-background-color: transparent;
          --rdg-header-background-color: rgba(248, 250, 252, 0.8);
          --rdg-row-hover-background-color: rgba(241, 245, 249, 0.5);
          --rdg-row-selected-background-color: rgba(238, 242, 255, 0.8);
          --rdg-cell-focus-box-shadow: inset 0 0 0 1px #818cf8;
          
          border: none;
          background: transparent;
          font-family: inherit;
        }
        .rdg-cell {
          border-right: 1px solid rgba(226, 232, 240, 0.3);
          border-bottom: 1px solid rgba(226, 232, 240, 0.6);
          padding-inline: 16px;
        }
        .rdg-row {
          background-color: rgba(255, 255, 255, 0.4);
          transition: background-color 0.15s ease;
        }
        .rdg-row:nth-child(even) {
          background-color: rgba(255, 255, 255, 0.1);
        }
        .rdg-row:hover {
          background-color: var(--rdg-row-hover-background-color);
        }
      `}</style>

      <DataGrid
        columns={columns}
        rows={data}
        rowKeyGetter={rowKeyGetter}
        className="h-full w-full text-[13px] border-none custom-scrollbar"
        rowHeight={44}
        headerRowHeight={48}
      />
    </div>
  );
}
