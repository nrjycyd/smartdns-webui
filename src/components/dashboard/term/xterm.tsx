"use client";

import * as React from 'react';

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SerializeAddon } from "@xterm/addon-serialize";
import { Alert, Box, SpeedDialAction, SpeedDialIcon } from '@mui/material';
import SpeedDial from '@mui/material/SpeedDial';

import "@xterm/xterm/css/xterm.css";
import KeyboardOptionKeyIcon from '@mui/icons-material/KeyboardOptionKey';
import TransitEnterexitIcon from '@mui/icons-material/TransitEnterexit';

// Move getCtrlChar to outer scope for unicorn/consistent-function-scoping
const getCtrlChar = (char: string): string => {
  const code = char.toUpperCase().codePointAt(0) ?? 0;
  return String.fromCodePoint(code - 64);
};

import {
  KeyboardControlKey as CtrlIcon,
  SelectAll,
  KeyboardTab as TabIcon,
} from '@mui/icons-material';
import { useUser } from '@/hooks/use-user';
import { authClient } from '@/lib/auth/client';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

type RefreshWinSizeType = () => void;

export function TerminalTable(): React.JSX.Element {

  const router = useRouter();
  const terminalRef = React.useRef<HTMLDivElement>(null);
  const termRef = React.useRef<Terminal | null>(null);
  const sockRef = React.useRef<WebSocket | null>(null);
  const refreshWinSizeRef = React.useRef<RefreshWinSizeType | null>(null);
  const speedDialRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const ctrl = React.useRef(false);
  const alt = React.useRef(false);
  const [isCtrlPressed, setIsCtrlPressed] = React.useState(false);
  const [isAltPressed, setIsAltPressed] = React.useState(false);
  const { checkSessionError, setXtermSocket, setXtermBuff } = useUser();
  const hasInitialized = React.useRef(false);
  const { t } = useTranslation();

  const { user } = useUser();
  const userRef = React.useRef(user);
  React.useEffect(() => { userRef.current = user; }, [user]);
  const isDisplayError = React.useMemo(() => user === null, [user]);

  React.useEffect(() => {
    const handleResize = (): void => {
      if (window.visualViewport) {
        const keyboardHeight = window.innerHeight - window.visualViewport.height;
        if (keyboardHeight > 20) {
          if (terminalRef.current) {
            terminalRef.current.style.height = `calc(${keyboardHeight}px + var(--Footer-height-mobile) + 24px)`;
          }

          if (speedDialRef.current) {
            speedDialRef.current.style.bottom = `calc(${keyboardHeight}px - var(--Footer-height-mobile) + 8px)`;
          }
        } else {
          if (terminalRef.current) {
            terminalRef.current.style.height = "100%";
          }
          if (speedDialRef.current) {
            speedDialRef.current.style.bottom = '16px';
          }
        }

        if (refreshWinSizeRef.current) {
          refreshWinSizeRef.current();
        }
      }
    };

    window.visualViewport?.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, []);

  type ActionId = 'SELECT_ALL' | 'CTRL' | 'ALT' | 'TAB' | 'ESC';

  const actions = React.useMemo(() => [
    { icon: <SelectAll />, name: t('SELECT ALL'), id: 'SELECT_ALL' as const },
    { icon: isCtrlPressed ? <CtrlIcon style={{ color: 'red' }} /> : <CtrlIcon />, name: 'CTRL', id: 'CTRL' as const },
    { icon: isAltPressed ? <KeyboardOptionKeyIcon style={{ color: 'red' }} /> : <KeyboardOptionKeyIcon />, name: 'ALT', id: 'ALT' as const },
    { icon: <TabIcon />, name: 'TAB', id: 'TAB' as const },
    { icon: <TransitEnterexitIcon />, name: 'ESC', id: 'ESC' as const },
  ], [isAltPressed, isCtrlPressed, t]);

  const pauseTerm = (): void => {
    const buffer = new ArrayBuffer(1);
    const dataview = new DataView(buffer);
    if (!sockRef.current) {
      return;
    }

    if (sockRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    dataview.setUint8(0, 3);
    sockRef.current.send(buffer);
  }

  const resumeTerm = (): void => {
    const buffer = new ArrayBuffer(1);
    const dataview = new DataView(buffer);
    if (!sockRef.current) {
      return;
    }

    if (sockRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    dataview.setUint8(0, 4);
    sockRef.current.send(buffer);
  }

  const setWinSize = (cols: number, rows: number): void => {
    const buffer = new ArrayBuffer(5);
    const dataview = new DataView(buffer);
    if (!sockRef.current) {
      return;
    }

    if (sockRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    dataview.setUint8(0, 2);
    dataview.setUint16(1, cols);
    dataview.setUint16(3, rows);
    sockRef.current.send(buffer);
  }

  React.useEffect(() => {
    if (hasInitialized.current) {
      return;
    }

    hasInitialized.current = true;
    let disposed = false;
    const session = userRef.current;

    const term = new Terminal(
      {
        smoothScrollDuration: 200,
        scrollSensitivity: 5,
        scrollback: 3500,
      }
    );
    termRef.current = term;

    const addonfit = new FitAddon();
    const addonserialize = new SerializeAddon();
    term.loadAddon(addonfit);
    term.loadAddon(new WebLinksAddon());
    term.loadAddon(addonserialize);

    if (terminalRef) {
      term.open(terminalRef.current!);
      addonfit.fit();
    }

    term.onData((data) => {
      if (!sockRef.current) {
        return;
      }

      if (sockRef.current.readyState !== WebSocket.OPEN) {
        return;
      }

      let sendData = data;

      if (ctrl.current) {
        sendData = getCtrlChar(sendData);
        ctrl.current = false;
        setIsCtrlPressed(false);
      }

      if (alt.current) {
        sockRef.current.send('\u001B');
        alt.current = false;
        setIsAltPressed(false);
      }

      sockRef.current.send(sendData);
    });

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    let refreshWin = false;

    if (session?.xtermSocket) {
      const socket = session?.xtermSocket as WebSocket;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        sockRef.current = session.xtermSocket as WebSocket;
        refreshWin = true;
        resumeTerm();
      } else {
  socket.close();
  setXtermSocket?.(null);
        term.write("Resume session failed...\r\n");
      }
    }

    if (!sockRef.current) {
      term.write(t('Connecting to xterm server...\r\n'));
      const socket = new WebSocket(`${protocol}://${window.location.host}/api/tool/term`);
      sockRef.current = socket;
  setXtermSocket?.(sockRef.current);
    }

    sockRef.current.onmessage = (event: MessageEvent) => {
      let data: ArrayBuffer;
      if (event.data instanceof ArrayBuffer) {
        data = event.data;
        processMessage(data);
      } else if (event.data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (result instanceof ArrayBuffer) {
            processMessage(result);
          } else {
            term.write("Invalid data type received.\r\n");
            if (sockRef.current) {
              sockRef.current.close();
              sockRef.current = null;
            }
          }
        };
        reader.readAsArrayBuffer(event.data);
      } else {
        term.write("Invalid data type received.\r\n");
  sockRef.current?.close();
  sockRef.current = null;
      }
    };

    sockRef.current.onerror = () => {
      authClient.checkLogin().then((data) => {
        if (data.error && checkSessionError) {
          checkSessionError(data.error).catch((_error: unknown) => {
            //NOOP
          });
          router.refresh();
        }
      }).catch((_error: unknown) => {
        //NOOP
      });
    }

    sockRef.current.onopen = () => {
      term.clear();
      term.reset();
      term.focus();
      addonfit.fit();
      setWinSize(term.cols, term.rows);
    };

    sockRef.current.onclose = () => {
      term.write(t("Connection closed.\r\n"));
      sockRef.current = null;
    }

    const handleWindowResize = (): void => {
      addonfit.fit();
      setWinSize(term.cols, term.rows);
    };
    const handleBeforeUnload = (): void => {
      sockRef.current?.close();
      sockRef.current = null;
    };
    window.addEventListener('resize', handleWindowResize);
    window.addEventListener('beforeunload', handleBeforeUnload);

    const element = terminalRef.current;
    let touchY: number | null = null;
    let touchId: number | null = null;
    let isScrolling = false;
    const handleTouchStart = (event: TouchEvent): void => {
      const touch = event.touches[0];
      if (!touch) return;
      touchY = touch.clientY;
      touchId = touch.identifier;
      isScrolling = false;
      event.preventDefault();
      event.stopPropagation();
    };
    const handleTouchMove = (event: TouchEvent): void => {
      const touch = [...event.touches].find((item) => item.identifier === touchId);
      if (!touch || touchY === null) return;
      event.preventDefault();
      event.stopPropagation();
      const lines = Math.trunc((touchY - touch.clientY) / 30);
      if (lines !== 0) {
        term.scrollLines(-lines);
        touchY -= lines * 30;
        isScrolling = true;
      }
    };
    const handleTouchEnd = (event: TouchEvent): void => {
      if (touchId === null || ![...event.changedTouches].some((touch) => touch.identifier === touchId)) return;
      event.preventDefault();
      event.stopPropagation();
      if (!isScrolling && event.type !== 'touchcancel') term.focus();
      touchY = null;
      touchId = null;
    };
    element?.addEventListener('touchstart', handleTouchStart, { passive: false });
    element?.addEventListener('touchmove', handleTouchMove, { passive: false });
    element?.addEventListener('touchend', handleTouchEnd);
    element?.addEventListener('touchcancel', handleTouchEnd);

    const refreshWinSize = (): void => {
      if (!termRef.current) {
        return;
      }
      addonfit.fit();
      setWinSize(termRef.current.cols, termRef.current.rows);
    }
    refreshWinSizeRef.current = refreshWinSize;

    const processMessage = (data: ArrayBuffer): void => {
      if (disposed || data.byteLength < 1) return;
      const dataview = new DataView(data);
      const type = dataview.getUint8(0);
      switch (type) {
        case 0: {
          const msgStr = new TextDecoder().decode(data.slice(1));
          term.write(msgStr);
          break;
        }
        case 1: {
          const errStr = new TextDecoder().decode(data.slice(1));
          term.write(errStr);
          break;
        }
        case 2: {
          if (data.byteLength < 5) return;
          const cols = dataview.getUint16(1);
          const rows = dataview.getUint16(3);
          term.resize(cols, rows);
          break;
        }
      }
    }

    if (refreshWin) {
      if (refreshWinSizeRef.current) {
        setWinSize(term.cols, term.rows + 10);
        addonfit.fit();
        refreshWinSizeRef.current();
      }

      if (session?.xtermBuff) {
        term.write(session.xtermBuff as Uint8Array);
      }
    }

    const socketSetBackgroupd = (): void => {
      if (!sockRef.current) {
        return;
      }

      if (sockRef.current.readyState !== WebSocket.OPEN && sockRef.current.readyState !== WebSocket.CONNECTING) {
        sockRef.current.close();
  setXtermSocket?.(null);
        return;
      }

      if (sockRef.current.readyState === WebSocket.OPEN) {
        pauseTerm();
      }

      sockRef.current.onopen = () => {
        // NOOP
      };
      sockRef.current.onmessage = () => {
        // NOOP
        if (session?.xtermBuff) {
          setXtermBuff?.(null);
        }
      };
      sockRef.current.onerror = () => {
        // NOOP
      };
      sockRef.current.onclose = () => {
  sockRef.current = null;
  setXtermSocket?.(null);
      };
    }

    return () => {
      disposed = true;
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      element?.removeEventListener('touchstart', handleTouchStart);
      element?.removeEventListener('touchmove', handleTouchMove);
      element?.removeEventListener('touchend', handleTouchEnd);
      element?.removeEventListener('touchcancel', handleTouchEnd);
      refreshWinSizeRef.current = null;
      termRef.current = null;
      socketSetBackgroupd();
      const strXterm = addonserialize.serialize();
      if (strXterm) {
        setXtermBuff?.(strXterm);
      }
      sockRef.current = null;
      hasInitialized.current = false;
      term.dispose();
    }
  }, [t, checkSessionError, router, setXtermSocket, setXtermBuff]);

  const handleSpeedDialClick = (event: React.MouseEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    setOpen((prevOpen) => !prevOpen);
    if (termRef.current) {
      termRef.current.focus();
    }
  };

  const handleSpeedDialActionClick = (id: ActionId) => (event: React.MouseEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    switch (id) {
      case 'SELECT_ALL': {
        if (termRef.current) {
          termRef.current.selectAll();
        }
        break;
      }
      case 'CTRL': {
        ctrl.current = !ctrl.current;
        setIsCtrlPressed(ctrl.current);
        break;
      }
      case 'ALT': {
        alt.current = !alt.current;
        setIsAltPressed(alt.current);
        break;
      }
      case 'TAB': {
        if (sockRef.current) {
          sockRef.current.send('\t');
        }
        break;
      }
      case 'ESC': {
        if (sockRef.current) {
          sockRef.current.send('\u001B');
        }
        break;
      }
    }

    if (termRef.current) {
      termRef.current.focus();
    }
  };

  if (isDisplayError) {
    if (user?.xtermSocket) {
      const socket = user.xtermSocket as WebSocket;
      socket.close();
      setXtermSocket?.(null);
    }
    return <Alert severity="info">Please Refresh Page.</Alert>;
  }

  return (
    <Box sx={{ position: 'relative', height: '100%', width: '100%' }}>
      <SpeedDial
        ref={speedDialRef}
        ariaLabel="Xterm ToolBar"
        sx={{
          position: 'absolute', bottom: 16, right: 16,
        }}

        icon={<SpeedDialIcon />}
        onClick={handleSpeedDialClick}
        open={open}
        direction="up"
      >
        {actions.map((action) => (
          <SpeedDialAction
            key={action.name}
            tooltipTitle={action.name}
            icon={action.icon}
            onClick={handleSpeedDialActionClick(action.id)}
          />
        ))}
      </SpeedDial>
      <Box
        ref={terminalRef}
        sx={{
          height: '100%',
          width: '100%',
        }}
      />
    </Box>
  );
}
