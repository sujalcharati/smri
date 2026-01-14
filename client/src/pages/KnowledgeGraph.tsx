import { useEffect, useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import ForceGraph2D from 'react-force-graph-2d'
import {
  Network,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  RefreshCw,
  FileText,
  User,
  Building,
  Code,
  Lightbulb,
  Folder,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/stores/authStore'
import { knowledgeApi } from '@/lib/api'

interface GraphNode {
  id: string
  label: string
  type: 'document' | 'entity'
  entityType?: string
  docType?: string
  size: number
  color?: string
  x?: number
  y?: number
}

interface GraphEdge {
  source: string
  target: string
  type: string
  weight: number
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphEdge[]
}

const entityColors: Record<string, string> = {
  person: '#3b82f6',
  organization: '#22c55e',
  project: '#f59e0b',
  technology: '#8b5cf6',
  concept: '#ec4899',
  document: '#6366f1',
}

const EntityIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'person':
      return <User className="h-4 w-4" />
    case 'organization':
      return <Building className="h-4 w-4" />
    case 'technology':
      return <Code className="h-4 w-4" />
    case 'concept':
      return <Lightbulb className="h-4 w-4" />
    case 'project':
      return <Folder className="h-4 w-4" />
    default:
      return <FileText className="h-4 w-4" />
  }
}

export default function KnowledgeGraph() {
  const { currentWorkspace } = useAuthStore()
  const graphRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] })
  const [stats, setStats] = useState({ documentCount: 0, entityCount: 0, edgeCount: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [filters, setFilters] = useState({
    showDocuments: true,
    showEntities: true,
    entityTypes: ['person', 'organization', 'project', 'technology', 'concept'],
  })

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: Math.max(500, window.innerHeight - 300),
        })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  const fetchGraph = useCallback(async () => {
    if (!currentWorkspace) return

    setIsLoading(true)
    try {
      const { data } = await knowledgeApi.getGraph(currentWorkspace.id)

      // Process nodes with colors
      const processedNodes = data.nodes.map((node: GraphNode) => ({
        ...node,
        color: node.type === 'document'
          ? entityColors.document
          : entityColors[node.entityType || 'concept'],
      }))

      setGraphData({ nodes: processedNodes, links: data.edges })
      setStats(data.stats)
    } catch (error) {
      console.error('Failed to fetch graph:', error)
    } finally {
      setIsLoading(false)
    }
  }, [currentWorkspace])

  useEffect(() => {
    fetchGraph()
  }, [fetchGraph])

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node)
    if (graphRef.current) {
      graphRef.current.centerAt(node.x, node.y, 500)
      graphRef.current.zoom(2, 500)
    }
  }, [])

  const handleZoomIn = () => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom()
      graphRef.current.zoom(currentZoom * 1.5, 300)
    }
  }

  const handleZoomOut = () => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom()
      graphRef.current.zoom(currentZoom / 1.5, 300)
    }
  }

  const handleReset = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 50)
    }
    setSelectedNode(null)
  }

  // Filter nodes based on current filters
  const filteredData = {
    nodes: graphData.nodes.filter((node) => {
      if (node.type === 'document' && !filters.showDocuments) return false
      if (node.type === 'entity') {
        if (!filters.showEntities) return false
        if (node.entityType && !filters.entityTypes.includes(node.entityType)) return false
      }
      return true
    }),
    links: graphData.links.filter((link) => {
      const sourceNode = graphData.nodes.find((n) => n.id === link.source)
      const targetNode = graphData.nodes.find((n) => n.id === link.target)
      if (!sourceNode || !targetNode) return false
      // Only include links where both nodes pass the filter
      const sourceVisible =
        (sourceNode.type === 'document' && filters.showDocuments) ||
        (sourceNode.type === 'entity' && filters.showEntities &&
          (!sourceNode.entityType || filters.entityTypes.includes(sourceNode.entityType)))
      const targetVisible =
        (targetNode.type === 'document' && filters.showDocuments) ||
        (targetNode.type === 'entity' && filters.showEntities &&
          (!targetNode.entityType || filters.entityTypes.includes(targetNode.entityType)))
      return sourceVisible && targetVisible
    }),
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Knowledge Graph</h1>
          <p className="text-muted-foreground">
            Visualize connections between documents and entities
          </p>
        </div>
        <Button onClick={fetchGraph} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Documents</p>
                <p className="text-2xl font-bold">{stats.documentCount}</p>
              </div>
              <FileText className="h-8 w-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Entities</p>
                <p className="text-2xl font-bold">{stats.entityCount}</p>
              </div>
              <Network className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Connections</p>
                <p className="text-2xl font-bold">{stats.edgeCount}</p>
              </div>
              <Network className="h-8 w-8 text-pink-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Graph */}
        <Card className="lg:col-span-3 border-0 shadow-lg overflow-hidden">
          <div className="relative" ref={containerRef}>
            {/* Controls */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
              <Button variant="secondary" size="icon" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="icon" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="icon" onClick={handleReset}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center" style={{ height: dimensions.height }}>
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">Building knowledge graph...</p>
                </div>
              </div>
            ) : filteredData.nodes.length === 0 ? (
              <div className="flex items-center justify-center" style={{ height: dimensions.height }}>
                <div className="text-center">
                  <Network className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No data to visualize</h3>
                  <p className="text-muted-foreground">
                    Upload and process documents to build your knowledge graph
                  </p>
                </div>
              </div>
            ) : (
              <ForceGraph2D
                ref={graphRef}
                graphData={filteredData}
                width={dimensions.width}
                height={dimensions.height}
                nodeLabel={(node: any) => node.label}
                nodeColor={(node: any) => node.color}
                nodeRelSize={6}
                nodeVal={(node: any) => node.size / 10}
                linkColor={() => 'rgba(100, 100, 100, 0.3)'}
                linkWidth={(link: any) => Math.max(1, link.weight / 5)}
                onNodeClick={handleNodeClick}
                cooldownTicks={100}
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.3}
              />
            )}
          </div>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Filters */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.showDocuments}
                    onChange={(e) =>
                      setFilters({ ...filters, showDocuments: e.target.checked })
                    }
                    className="rounded border-gray-300"
                  />
                  <FileText className="h-4 w-4 text-indigo-500" />
                  <span className="text-sm">Documents</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.showEntities}
                    onChange={(e) =>
                      setFilters({ ...filters, showEntities: e.target.checked })
                    }
                    className="rounded border-gray-300"
                  />
                  <Network className="h-4 w-4 text-purple-500" />
                  <span className="text-sm">Entities</span>
                </label>
              </div>

              {filters.showEntities && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground">Entity Types</p>
                  {['person', 'organization', 'project', 'technology', 'concept'].map(
                    (type) => (
                      <label key={type} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filters.entityTypes.includes(type)}
                          onChange={(e) => {
                            setFilters({
                              ...filters,
                              entityTypes: e.target.checked
                                ? [...filters.entityTypes, type]
                                : filters.entityTypes.filter((t) => t !== type),
                            })
                          }}
                          className="rounded border-gray-300"
                        />
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: entityColors[type] }}
                        />
                        <span className="text-sm capitalize">{type}</span>
                      </label>
                    )
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected Node Info */}
          {selectedNode && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <EntityIcon type={selectedNode.entityType || selectedNode.type} />
                    Selected Node
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className="w-4 h-4 rounded-full mb-3"
                    style={{ backgroundColor: selectedNode.color }}
                  />
                  <h4 className="font-medium mb-1">{selectedNode.label}</h4>
                  <p className="text-sm text-muted-foreground capitalize">
                    {selectedNode.type === 'entity'
                      ? selectedNode.entityType
                      : selectedNode.docType || 'Document'}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Legend */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Legend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(entityColors).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm capitalize">{type}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
