import { useState, useEffect } from 'react';
import { parseClasses } from '../../overlay/src/class-parser';
import { connect, onMessage, onConnect, onDisconnect, isConnected } from './ws';
import { Picker } from './Picker';
import { usePatchManager } from './hooks/usePatchManager';
import { PatchPopover } from './components/PatchPopover';

interface ElementData {
  componentName: string;
  instanceCount: number;
  classes: string;
  tailwindConfig: any;
}

export function App() {
  const [wsConnected, setWsConnected] = useState(false);
  const [elementData, setElementData] = useState<ElementData | null>(null);
  const patchManager = usePatchManager();

  useEffect(() => {
    onConnect(() => setWsConnected(true));
    onDisconnect(() => setWsConnected(false));

    onMessage((msg) => {
      if (msg.type === 'ELEMENT_SELECTED') {
        setElementData({
          componentName: msg.componentName,
          instanceCount: msg.instanceCount,
          classes: msg.classes,
          tailwindConfig: msg.tailwindConfig,
        });
      } else if (msg.type === 'PATCH_UPDATE') {
        patchManager.handlePatchUpdate({
          staged: msg.staged,
          committed: msg.committed,
          implementing: msg.implementing,
          implemented: msg.implemented,
          patches: msg.patches,
        });
      }
    });

    connect();
    setWsConnected(isConnected());
  }, []);

  const { staged, committed, implementing, implemented } = patchManager.counts;

  const queueFooter = (
    <div className="flex items-center justify-center px-3 py-1.5 border-t border-bv-border shrink-0 gap-2.5">
      <PatchPopover
        label="staged"
        count={staged}
        items={patchManager.patches}
        activeColor="text-bv-text"
        onDiscard={(id: string) => patchManager.discard(id)}
        onCommitAll={() => patchManager.commitAll()}
        onDiscardAll={() => patchManager.discardAll()}
      />
      <span className="text-bv-border text-[11px]">·</span>
      <PatchPopover
        label="committed"
        count={committed}
        items={patchManager.serverPatches.committed}
        activeColor="text-bv-orange"
      />
      <span className="text-bv-border text-[11px]">·</span>
      <PatchPopover
        label="implementing"
        count={implementing}
        items={patchManager.serverPatches.implementing}
        activeColor="text-bv-orange"
      />
      <span className="text-bv-border text-[11px]">·</span>
      <PatchPopover
        label="implemented"
        count={implemented}
        items={patchManager.serverPatches.implemented}
        activeColor="text-bv-teal"
      />
    </div>
  );

  if (!wsConnected) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6">
          <div className="w-2 h-2 rounded-full bg-bv-orange animate-pulse" />
          <span className="text-bv-text-mid text-[12px]">Waiting for connection…</span>
        </div>
        {queueFooter}
      </div>
    );
  }

  if (!elementData) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6">
          <span className="text-3xl mb-2 opacity-30">⊕</span>
          <span className="text-bv-text-mid text-[12px]">Click an element to inspect</span>
        </div>
        {queueFooter}
      </div>
    );
  }

  const parsedClasses = parseClasses(elementData.classes);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <Picker
          componentName={elementData.componentName}
          instanceCount={elementData.instanceCount}
          parsedClasses={parsedClasses}
          tailwindConfig={elementData.tailwindConfig}
          patchManager={patchManager}
        />
      </div>
      {queueFooter}
    </div>
  );
}

