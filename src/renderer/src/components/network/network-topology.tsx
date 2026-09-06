import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@heroui/react'
import {
  IoDesktopOutline,
  IoFunnelOutline,
  IoGitNetworkOutline,
  IoPauseOutline,
  IoPlayOutline,
  IoServerOutline
} from 'react-icons/io5'
import { MdTag } from 'react-icons/md'
import { calcTraffic } from '@renderer/utils/calc'

type NodeType = 'group' | 'proxy' | 'rule' | 'client' | 'port'

interface TopoNode {
  id: string
  name: string
  type: NodeType
  connections: number
  traffic: number
  children?: TopoNode[]
}

interface LayoutNode {
  data: TopoNode
  depth: number
  x: number
  y: number
  width: number
  children: LayoutNode[]
  collapsed: boolean
}

const NODE_HEIGHT = 30
const NODE_PADDING_X = 16
const LEVEL_GAP = 44
const ROW_GAP = 50
const TOP_PADDING = 30
const LEFT_PADDING = 70
const RIGHT_PADDING = 40

function buildHierarchy(connections: ControllerConnectionDetail[]): TopoNode {
  const groups = new Map<string, TopoNode>()
  const proxies = new Map<string, TopoNode>()
  const rules = new Map<string, TopoNode>()
  const clients = new Map<string, TopoNode>()
  const ports = new Map<string, TopoNode>()
  const groupOrder: string[] = []
  const proxyOrder: string[] = []
  const ruleOrder: string[] = []
  const clientOrder: string[] = []
  const portOrder: string[] = []
  const groupProxies = new Map<string, string[]>()
  const proxyRules = new Map<string, string[]>()
  const ruleClients = new Map<string, string[]>()
  const clientPorts = new Map<string, string[]>()

  for (const conn of connections) {
    const clientIP = conn.metadata.sourceIP || 'Unknown'
    const sourcePort = String(conn.metadata.sourcePort || 'Unknown')
    const ruleType = conn.rule || 'Direct'
    const fullRule = conn.rulePayload ? `${ruleType}: ${conn.rulePayload}` : ruleType
    const chains = conn.chains || []
    const proxy = chains[0] ?? 'Direct'
    const group = chains.length > 1 ? (chains[1] ?? 'Direct') : (chains[0] ?? 'Direct')
    const traffic = conn.download + conn.upload

    if (!groups.has(group)) {
      groups.set(group, {
        id: `group-${group}`,
        name: group,
        type: 'group',
        connections: 0,
        traffic: 0
      })
      groupOrder.push(group)
      groupProxies.set(group, [])
    }
    const g = groups.get(group)!
    g.connections++
    g.traffic += traffic

    const proxyKey = `${group}\u0000${proxy}`
    if (!proxies.has(proxyKey)) {
      proxies.set(proxyKey, {
        id: `proxy-${proxyKey}`,
        name: proxy,
        type: 'proxy',
        connections: 0,
        traffic: 0
      })
      proxyOrder.push(proxyKey)
      groupProxies.get(group)!.push(proxyKey)
      proxyRules.set(proxyKey, [])
    }
    const p = proxies.get(proxyKey)!
    p.connections++
    p.traffic += traffic

    const ruleKey = `${proxyKey}\u0000${fullRule}`
    if (!rules.has(ruleKey)) {
      rules.set(ruleKey, {
        id: `rule-${ruleKey}`,
        name: fullRule,
        type: 'rule',
        connections: 0,
        traffic: 0
      })
      ruleOrder.push(ruleKey)
      proxyRules.get(proxyKey)!.push(ruleKey)
      ruleClients.set(ruleKey, [])
    }
    const r = rules.get(ruleKey)!
    r.connections++
    r.traffic += traffic

    const clientKey = `${ruleKey}\u0000${clientIP}`
    if (!clients.has(clientKey)) {
      clients.set(clientKey, {
        id: `client-${clientKey}`,
        name: clientIP,
        type: 'client',
        connections: 0,
        traffic: 0
      })
      clientOrder.push(clientKey)
      ruleClients.get(ruleKey)!.push(clientKey)
      clientPorts.set(clientKey, [])
    }
    const c = clients.get(clientKey)!
    c.connections++
    c.traffic += traffic

    const portKey = `${clientKey}\u0000${sourcePort}`
    if (!ports.has(portKey)) {
      ports.set(portKey, {
        id: `port-${portKey}`,
        name: sourcePort,
        type: 'port',
        connections: 0,
        traffic: 0
      })
      portOrder.push(portKey)
      clientPorts.get(clientKey)!.push(portKey)
    }
    ports.get(portKey)!.connections++
    ports.get(portKey)!.traffic += traffic
  }

  const children: TopoNode[] = groupOrder.map((gk) => {
    const g = groups.get(gk)!
    return {
      ...g,
      children: groupProxies.get(gk)!.map((pk) => {
        const p = proxies.get(pk)!
        return {
          ...p,
          children: proxyRules.get(pk)!.map((rk) => {
            const r = rules.get(rk)!
            return {
              ...r,
              children: ruleClients.get(rk)!.map((ck) => {
                const c = clients.get(ck)!
                return { ...c, children: clientPorts.get(ck)!.map((ptk) => ports.get(ptk)!) }
              })
            }
          })
        }
      })
    }
  })

  return {
    id: 'root',
    name: 'root',
    type: 'group',
    connections: connections.length,
    traffic: connections.reduce((s, c) => s + c.download + c.upload, 0),
    children
  }
}

let measureCanvas: HTMLCanvasElement | null = null
function getTextWidth(text: string): number {
  if (!measureCanvas) measureCanvas = document.createElement('canvas')
  const ctx = measureCanvas.getContext('2d')
  if (!ctx) return text.length * 7
  ctx.font = '600 11px sans-serif'
  return ctx.measureText(text).width
}

// 紧凑排列：叶子节点顺序占行，父节点居中于首末子节点之间
function layoutTree(
  data: TopoNode,
  levelX: Map<number, number>,
  collapsedSet: Set<string>,
  depth: number,
  leafCursor: { row: number }
): LayoutNode {
  const childData = data.children || []
  const hasChildren = childData.length > 0
  const collapsed = hasChildren && collapsedSet.has(data.id)
  const textWidth =
    data.type === 'port' ? getTextWidth(data.name) : Math.max(getTextWidth(data.name), 44)
  const width = textWidth + NODE_PADDING_X * 2

  const children: LayoutNode[] = []
  if (hasChildren && !collapsed) {
    for (const child of childData) {
      children.push(layoutTree(child, levelX, collapsedSet, depth + 1, leafCursor))
    }
  }

  let y: number
  if (children.length > 0) {
    y = (children[0].y + children[children.length - 1].y) / 2
  } else {
    y = leafCursor.row * ROW_GAP
    leafCursor.row++
  }

  return { data, depth, x: levelX.get(depth) ?? 0, y, width, children, collapsed }
}

function computeLevelX(root: TopoNode): Map<number, number> {
  const maxWidthPerLevel = new Map<number, number>()
  const visit = (node: TopoNode, depth: number): void => {
    if (depth > 0) {
      const w = (node.children?.length ? 220 : 0) || getTextWidth(node.name) + NODE_PADDING_X * 2
      maxWidthPerLevel.set(depth, Math.max(maxWidthPerLevel.get(depth) ?? 0, w))
    }
    for (const child of node.children || []) visit(child, depth + 1)
  }
  visit(root, 0)

  const levelX = new Map<number, number>()
  let cumX = 0
  for (let depth = 1; depth <= maxWidthPerLevel.size; depth++) {
    const curW = maxWidthPerLevel.get(depth) ?? 100
    cumX =
      depth === 1
        ? curW / 2
        : cumX + (maxWidthPerLevel.get(depth - 1) ?? 100) / 2 + LEVEL_GAP + curW / 2
    levelX.set(depth, cumX)
  }
  return levelX
}

const NODE_COLORS: Record<NodeType, { fill: string; bg: string }> = {
  group: { fill: 'hsl(var(--heroui-success))', bg: 'hsl(var(--heroui-success) / 0.15)' },
  proxy: { fill: 'hsl(var(--heroui-danger))', bg: 'hsl(var(--heroui-danger) / 0.15)' },
  rule: { fill: 'hsl(var(--heroui-secondary))', bg: 'hsl(var(--heroui-secondary) / 0.15)' },
  client: { fill: 'hsl(var(--heroui-primary))', bg: 'hsl(var(--heroui-primary) / 0.15)' },
  port: { fill: 'hsl(var(--heroui-warning))', bg: 'hsl(var(--heroui-warning) / 0.15)' }
}

const NetworkTopologyCard: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [connections, setConnections] = useState<ControllerConnectionDetail[]>([])
  const [isPaused, setIsPaused] = useState(false)
  const frozenRef = useRef<ControllerConnectionDetail[] | null>(null)
  const [userOverrides, setUserOverrides] = useState<Record<string, boolean>>({})
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    if (isPaused) return
    const handler = (_e: unknown, info: ControllerConnections): void => {
      setConnections(info.connections ?? [])
    }
    window.electron.ipcRenderer.on('mihomoConnections', handler)
    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('mihomoConnections')
    }
  }, [isPaused])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setContainerWidth(el.clientWidth))
    observer.observe(el)
    setContainerWidth(el.clientWidth)
    return (): void => observer.disconnect()
  }, [])

  const currentConnections = isPaused && frozenRef.current ? frozenRef.current : connections

  const stats = useMemo(() => {
    const clients = new Set<string>()
    const rules = new Set<string>()
    const groups = new Set<string>()
    const proxies = new Set<string>()
    for (const c of currentConnections) {
      clients.add(c.metadata.sourceIP || 'Unknown')
      rules.add(c.rule || 'Direct')
      const ch = c.chains || []
      proxies.add(ch[0] ?? 'Direct')
      groups.add(ch.length > 1 ? (ch[1] ?? 'Direct') : (ch[0] ?? 'Direct'))
    }
    return {
      clientCount: clients.size,
      ruleCount: rules.size,
      groupCount: groups.size,
      proxyCount: proxies.size,
      totalTraffic: currentConnections.reduce((s, c) => s + c.download + c.upload, 0)
    }
  }, [currentConnections])

  const tree = useMemo(() => buildHierarchy(currentConnections), [currentConnections])

  // 默认展开前两层，更深的规则/客户端折叠；用户操作覆盖默认值，
  // 覆盖项以单条连接是否出现无关的稳定节点 id 为键，不受连接刷新影响
  const defaultCollapsed = useMemo(() => {
    const ids = new Set<string>()
    const visit = (node: TopoNode, depth: number): void => {
      if (depth >= 2 && (node.children?.length ?? 0) > 0) ids.add(node.id)
      for (const child of node.children || []) visit(child, depth + 1)
    }
    visit(tree, 0)
    return ids
  }, [tree])

  const layout = useMemo(() => {
    if (!tree.children || tree.children.length === 0) return null
    const levelX = computeLevelX(tree)
    const effective = new Set(defaultCollapsed)
    for (const [id, collapsed] of Object.entries(userOverrides)) {
      if (collapsed) effective.add(id)
      else effective.delete(id)
    }
    return layoutTree(tree, levelX, effective, 0, { row: 0 })
  }, [tree, defaultCollapsed, userOverrides])

  const toggleCollapse = useCallback((node: LayoutNode): void => {
    const hasChildren = node.children.length > 0 || node.collapsed
    if (!hasChildren) return
    setUserOverrides((prev) => ({ ...prev, [node.data.id]: !node.collapsed }))
  }, [])

  const svgWidth = useMemo(() => {
    if (!layout) return containerWidth || 600
    let maxY = 0
    let minY = Infinity
    const visit = (node: LayoutNode): void => {
      maxY = Math.max(maxY, node.x + node.width / 2)
      minY = Math.min(minY, node.y)
      node.children.forEach(visit)
    }
    visit(layout)
    return Math.max(containerWidth || 600, maxY + RIGHT_PADDING)
  }, [layout, containerWidth])

  const svgHeight = useMemo(() => {
    if (!layout) return 400
    let minRow = Infinity
    let maxRow = -Infinity
    const visit = (node: LayoutNode): void => {
      minRow = Math.min(minRow, node.y)
      maxRow = Math.max(maxRow, node.y)
      node.children.forEach(visit)
    }
    visit(layout)
    return maxRow - minRow + NODE_HEIGHT + TOP_PADDING * 2
  }, [layout])

  const offsetY = svgHeight / 2

  const renderNode = (node: LayoutNode): React.JSX.Element[] => {
    const elements: React.JSX.Element[] = []
    const color = NODE_COLORS[node.data.type]
    const x = LEFT_PADDING + node.x
    const y = node.y - offsetY
    const hasChildren = node.children.length > 0 || node.collapsed

    for (const child of node.children) {
      const cx = LEFT_PADDING + child.x
      const cy = child.y - offsetY
      const sx = x + node.width / 2
      const tx = cx - child.width / 2
      const mx = (sx + tx) / 2
      elements.push(
        <path
          key={`link-${node.data.id}-${child.data.id}`}
          d={`M${sx},${y} C${mx},${y} ${mx},${cy} ${tx},${cy}`}
          fill="none"
          stroke="hsl(var(--heroui-foreground))"
          strokeOpacity={0.3}
          strokeWidth={Math.max(1, Math.min(4, child.data.connections / 5))}
        />
      )
    }

    elements.push(
      <g
        key={`node-${node.data.id}`}
        transform={`translate(${x}, ${y})`}
        style={{ cursor: hasChildren ? 'pointer' : 'default' }}
        onClick={() => toggleCollapse(node)}
      >
        <title>
          {`${node.data.name}\n${node.data.connections} 个连接\n${calcTraffic(node.data.traffic)}`}
        </title>
        <text
          dy={-NODE_HEIGHT / 2 - 5}
          textAnchor="middle"
          fill={color.fill}
          fontSize="10px"
          fontWeight="500"
        >
          {node.data.connections}
        </text>
        <rect
          x={-node.width / 2}
          y={-NODE_HEIGHT / 2}
          width={node.width}
          height={NODE_HEIGHT}
          rx={6}
          fill={color.bg}
          stroke={color.fill}
          strokeWidth={1.5}
        />
        <text dy="0.32em" textAnchor="middle" fill={color.fill} fontSize="11px" fontWeight="600">
          {node.data.name}
        </text>
        {hasChildren && (
          <text
            x={node.width / 2 - 11}
            dy="0.35em"
            textAnchor="middle"
            fill={color.fill}
            fontSize="14px"
            fontWeight="700"
          >
            {node.collapsed ? '+' : '−'}
          </text>
        )}
      </g>
    )

    node.children.forEach((child) => elements.push(...renderNode(child)))
    return elements
  }

  const togglePause = useCallback(() => {
    if (isPaused) {
      frozenRef.current = null
    } else {
      frozenRef.current = [...connections]
    }
    setIsPaused((p) => !p)
  }, [isPaused, connections])

  return (
    <div className="rounded-xl border border-foreground/10 bg-content1 p-4 shadow-sm">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/15 text-success">
            <IoGitNetworkOutline size={18} />
          </div>
          <h3 className="text-[15px] font-semibold">网络拓扑</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden flex-wrap gap-x-2 text-[12px] text-foreground/50 sm:flex">
            <span>{stats.clientCount} 设备</span>
            <span>·</span>
            <span>{stats.ruleCount} 规则</span>
            <span>·</span>
            <span>{stats.groupCount} 策略组</span>
            <span>·</span>
            <span>{stats.proxyCount} 节点</span>
            <span>·</span>
            <span>{calcTraffic(stats.totalTraffic)}</span>
          </div>
          <Button
            size="sm"
            isIconOnly
            variant="light"
            onPress={togglePause}
            className={`h-7 w-7 min-w-0 ${isPaused ? 'text-warning' : ''}`}
            title={isPaused ? '恢复' : '暂停'}
          >
            {isPaused ? <IoPlayOutline size={16} /> : <IoPauseOutline size={16} />}
          </Button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-3 text-[12px] text-foreground/60">
        <span className="flex items-center gap-1">
          <IoGitNetworkOutline className="text-success" size={13} />
          策略组
        </span>
        <span className="flex items-center gap-1">
          <IoServerOutline className="text-danger" size={13} />
          节点
        </span>
        <span className="flex items-center gap-1">
          <IoFunnelOutline className="text-secondary" size={13} />
          规则
        </span>
        <span className="flex items-center gap-1">
          <IoDesktopOutline className="text-primary" size={13} />
          来源 IP
        </span>
        <span className="flex items-center gap-1">
          <MdTag className="text-warning" size={13} />
          来源端口
        </span>
      </div>

      {currentConnections.length === 0 || !layout ? (
        <div className="flex flex-col items-center justify-center py-10 text-foreground/40">
          <IoGitNetworkOutline size={32} className="mb-2 animate-pulse" />
          <span className="text-sm">等待连接数据</span>
        </div>
      ) : (
        <div ref={containerRef} className="overflow-x-auto touch-pan-x touch-pan-y">
          <svg width={svgWidth} height={svgHeight} style={{ minHeight: '400px' }}>
            {renderNode(layout)}
          </svg>
        </div>
      )}
    </div>
  )
}

export default NetworkTopologyCard
