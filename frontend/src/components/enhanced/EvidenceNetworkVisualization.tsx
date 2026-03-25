import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as d3 from 'd3'
import { 
  Eye, 
  Filter, 
  Settings, 
  Layers, 
  Search,
  BarChart3,
  Network,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react'

interface EvidenceNode {
  id: string
  title: string
  type: 'clinical_trial' | 'real_world_evidence' | 'literature' | 'synthetic_control'
  sourceType: 'pubmed' | 'clinicaltrials' | 'uploaded' | 'institutional'
  qualityScore: number
  comparabilityScore: number
  biasRisk: number
  sampleSize: number
  studyYear: number
  therapeuticArea: string
  primaryEndpoint: string
  population: {
    ageRange: string
    gender: string
    conditions: string[]
  }
  regulatorySignificance: boolean
  isAnchorCandidate: boolean
}

interface EvidenceRelationship {
  source: string
  target: string
  relationshipType: 'similar_population' | 'shared_endpoint' | 'temporal_overlap' | 'methodological_similarity'
  strength: number
  confidence: number
}

interface EvidenceNetworkData {
  nodes: EvidenceNode[]
  relationships: EvidenceRelationship[]
}

interface VisualizationFilter {
  qualityRange: [number, number]
  comparabilityRange: [number, number]
  biasRiskRange: [number, number]
  evidenceTypes: string[]
  sourceSources: string[]
  studyYearRange: [number, number]
  therapeuticAreas: string[]
  showOnlyAnchors: boolean
  relationshipTypes: string[]
}

interface EvidenceNetworkVisualizationProps {
  projectId: string
  onNodeSelect: (node: EvidenceNode) => void
  onRelationshipExplore: (relationship: EvidenceRelationship) => void
  height?: number
}

const EvidenceNetworkVisualization: React.FC<EvidenceNetworkVisualizationProps> = ({
  projectId,
  onNodeSelect,
  onRelationshipExplore,
  height = 600
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simulationRef = useRef<d3.Simulation<EvidenceNode, undefined> | null>(null)
  
  const [data, setData] = useState<EvidenceNetworkData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<EvidenceNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<EvidenceNode | null>(null)
  const [filters, setFilters] = useState<VisualizationFilter>({
    qualityRange: [0, 1],
    comparabilityRange: [0, 1],
    biasRiskRange: [0, 1],
    evidenceTypes: ['clinical_trial', 'real_world_evidence', 'literature', 'synthetic_control'],
    sourceSources: ['pubmed', 'clinicaltrials', 'uploaded', 'institutional'],
    studyYearRange: [2000, 2024],
    therapeuticAreas: [],
    showOnlyAnchors: false,
    relationshipTypes: ['similar_population', 'shared_endpoint', 'temporal_overlap', 'methodological_similarity']
  })
  const [viewMode, setViewMode] = useState<'network' | 'cluster' | 'timeline' | 'quality'>('network')
  const [showFilters, setShowFilters] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)

  const fetchEvidenceNetwork = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/evidence/network`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        }
      })
      const networkData = await response.json()
      setData(networkData)
    } catch (error) {
      console.error('Failed to fetch evidence network:', error)
    }
    setIsLoading(false)
  }, [projectId])

  useEffect(() => {
    fetchEvidenceNetwork()
  }, [fetchEvidenceNetwork])

  const getNodeColor = useCallback((node: EvidenceNode) => {
    switch (viewMode) {
      case 'network':
        if (node.isAnchorCandidate) return '#059669' // Success green
        return node.type === 'clinical_trial' ? '#3B82F6' : 
               node.type === 'real_world_evidence' ? '#8B5CF6' :
               node.type === 'literature' ? '#F59E0B' : '#EF4444'
      
      case 'cluster':
        const hash = node.therapeuticArea.split('').reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0)
          return a & a
        }, 0)
        return d3.schemeCategory10[Math.abs(hash) % 10]
      
      case 'quality':
        return d3.interpolateRdYlGn(node.qualityScore)
      
      case 'timeline':
        const yearRange = [2000, 2024]
        const yearNormalized = (node.studyYear - yearRange[0]) / (yearRange[1] - yearRange[0])
        return d3.interpolateViridis(yearNormalized)
      
      default:
        return '#6B7280'
    }
  }, [viewMode])

  const getNodeSize = useCallback((node: EvidenceNode) => {
    const baseSize = 8
    const sizeMultiplier = Math.log(node.sampleSize + 1) / Math.log(10000) // Log scale for sample size
    return baseSize + (sizeMultiplier * 15)
  }, [])

  const filterNodes = useCallback((nodes: EvidenceNode[]): EvidenceNode[] => {
    return nodes.filter(node => {
      return (
        node.qualityScore >= filters.qualityRange[0] &&
        node.qualityScore <= filters.qualityRange[1] &&
        node.comparabilityScore >= filters.comparabilityRange[0] &&
        node.comparabilityScore <= filters.comparabilityRange[1] &&
        node.biasRisk >= filters.biasRiskRange[0] &&
        node.biasRisk <= filters.biasRiskRange[1] &&
        filters.evidenceTypes.includes(node.type) &&
        filters.sourceSources.includes(node.sourceType) &&
        node.studyYear >= filters.studyYearRange[0] &&
        node.studyYear <= filters.studyYearRange[1] &&
        (filters.therapeuticAreas.length === 0 || filters.therapeuticAreas.includes(node.therapeuticArea)) &&
        (!filters.showOnlyAnchors || node.isAnchorCandidate)
      )
    })
  }, [filters])

  const initializeVisualization = useCallback(() => {
    if (!data || !svgRef.current || !containerRef.current) return

    const container = containerRef.current
    const svg = d3.select(svgRef.current)
    const width = container.clientWidth
    
    // Clear previous content
    svg.selectAll('*').remove()
    
    // Filter data
    const filteredNodes = filterNodes(data.nodes)
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id))
    const filteredRelationships = data.relationships.filter(r => 
      filteredNodeIds.has(r.source) && 
      filteredNodeIds.has(r.target) &&
      filters.relationshipTypes.includes(r.relationshipType)
    )

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        const { transform } = event
        setZoomLevel(transform.k)
        g.attr('transform', transform)
      })

    svg.call(zoom)

    // Create main group
    const g = svg.append('g')

    // Create force simulation
    const simulation = d3.forceSimulation<EvidenceNode>(filteredNodes)
      .force('link', d3.forceLink<EvidenceNode, EvidenceRelationship>(filteredRelationships)
        .id(d => d.id)
        .distance(d => 100 / (d.strength + 0.1))
        .strength(d => d.strength)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => getNodeSize(d) + 2))

    simulationRef.current = simulation

    // Create links
    const link = g.append('g')
      .selectAll('line')
      .data(filteredRelationships)
      .enter().append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', d => d.confidence * 0.8)
      .attr('stroke-width', d => Math.sqrt(d.strength) * 3)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation()
        onRelationshipExplore(d)
      })

    // Create nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(filteredNodes)
      .enter().append('circle')
      .attr('r', getNodeSize)
      .attr('fill', getNodeColor)
      .attr('stroke', d => selectedNode?.id === d.id ? '#1F2937' : '#fff')
      .attr('stroke-width', d => selectedNode?.id === d.id ? 3 : 2)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation()
        setSelectedNode(d)
        onNodeSelect(d)
      })
      .on('mouseover', (event, d) => {
        setHoveredNode(d)
      })
      .on('mouseout', () => {
        setHoveredNode(null)
      })

    // Create node labels
    const label = g.append('g')
      .selectAll('text')
      .data(filteredNodes)
      .enter().append('text')
      .text(d => d.title.substring(0, 30) + (d.title.length > 30 ? '...' : ''))
      .style('font-size', '10px')
      .style('text-anchor', 'middle')
      .style('fill', '#374151')
      .style('pointer-events', 'none')
      .style('opacity', d => d.isAnchorCandidate || selectedNode?.id === d.id ? 1 : 0.7)

    // Add drag behavior
    node.call(
      d3.drag<SVGCircleElement, EvidenceNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
        })
    )

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as EvidenceNode).x!)
        .attr('y1', d => (d.source as EvidenceNode).y!)
        .attr('x2', d => (d.target as EvidenceNode).x!)
        .attr('y2', d => (d.target as EvidenceNode).y!)

      node
        .attr('cx', d => d.x!)
        .attr('cy', d => d.y!)

      label
        .attr('x', d => d.x!)
        .attr('y', d => d.y! - getNodeSize(d) - 5)
    })

  }, [data, filters, viewMode, selectedNode, getNodeColor, getNodeSize, filterNodes, onNodeSelect, onRelationshipExplore, height])

  useEffect(() => {
    if (data) {
      initializeVisualization()
    }
  }, [data, initializeVisualization])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (data) {
        initializeVisualization()
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [data, initializeVisualization])

  const handleZoomIn = () => {
    if (svgRef.current) {
      d3.select(svgRef.current).transition().call(
        d3.zoom<SVGSVGElement, unknown>().scaleBy as any, 1.5
      )
    }
  }

  const handleZoomOut = () => {
    if (svgRef.current) {
      d3.select(svgRef.current).transition().call(
        d3.zoom<SVGSVGElement, unknown>().scaleBy as any, 1 / 1.5
      )
    }
  }

  const handleReset = () => {
    if (svgRef.current) {
      d3.select(svgRef.current).transition().call(
        d3.zoom<SVGSVGElement, unknown>().transform as any,
        d3.zoomIdentity
      )
      setZoomLevel(1)
    }
  }

  if (isLoading) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="flex items-center space-x-3">
            <div className="animate-pulse bg-gray-200 h-6 w-6 rounded"></div>
            <div className="animate-pulse bg-gray-200 h-6 w-48 rounded"></div>
          </div>
        </div>
        <div className="card-body">
          <div className="flex items-center justify-center" style={{ height: height }}>
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="body-normal text-gray-600">Loading evidence network...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="text-center py-12">
            <Network className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="heading-4 mb-2">No Evidence Network Available</h3>
            <p className="body-normal text-gray-600">
              Unable to load evidence network data.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Network className="w-6 h-6 text-primary-600" />
              <div>
                <h3 className="heading-4">Evidence Network Visualization</h3>
                <p className="body-small text-gray-600">
                  Interactive exploration of evidence relationships and patterns
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* View Mode Selector */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                {[
                  { key: 'network', label: 'Network', icon: Network },
                  { key: 'cluster', label: 'Cluster', icon: Layers },
                  { key: 'quality', label: 'Quality', icon: BarChart3 },
                  { key: 'timeline', label: 'Timeline', icon: Eye }
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setViewMode(key as any)}
                    className={`
                      flex items-center space-x-1 px-3 py-1 rounded text-sm font-medium transition-colors
                      ${viewMode === key 
                        ? 'bg-white text-primary-600 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Zoom Controls */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button onClick={handleZoomIn} className="p-2 hover:bg-gray-200 rounded">
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button onClick={handleZoomOut} className="p-2 hover:bg-gray-200 rounded">
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button onClick={handleReset} className="p-2 hover:bg-gray-200 rounded">
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`
                  btn btn-sm
                  ${showFilters ? 'btn-primary' : 'btn-secondary'}
                `}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </button>
            </div>
          </div>
        </div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-gray-200 p-6 bg-gray-50"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Quality Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quality Score Range
                  </label>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={filters.qualityRange[0]}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        qualityRange: [parseFloat(e.target.value), prev.qualityRange[1]]
                      }))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{filters.qualityRange[0].toFixed(1)}</span>
                      <span>{filters.qualityRange[1].toFixed(1)}</span>
                    </div>
                  </div>
                </div>

                {/* Evidence Types */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Evidence Types
                  </label>
                  <div className="space-y-2">
                    {['clinical_trial', 'real_world_evidence', 'literature', 'synthetic_control'].map(type => (
                      <label key={type} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={filters.evidenceTypes.includes(type)}
                          onChange={(e) => {
                            const newTypes = e.target.checked
                              ? [...filters.evidenceTypes, type]
                              : filters.evidenceTypes.filter(t => t !== type)
                            setFilters(prev => ({ ...prev, evidenceTypes: newTypes }))
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm capitalize">
                          {type.replace('_', ' ')}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Show Only Anchors */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Display Options
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.showOnlyAnchors}
                      onChange={(e) => setFilters(prev => ({ 
                        ...prev, 
                        showOnlyAnchors: e.target.checked 
                      }))}
                      className="mr-2"
                    />
                    <span className="text-sm">Show only anchor candidates</span>
                  </label>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Visualization */}
      <div className="card">
        <div className="card-body p-0">
          <div ref={containerRef} className="relative">
            <svg
              ref={svgRef}
              width="100%"
              height={height}
              className="border-none"
            />
            
            {/* Node Details Overlay */}
            <AnimatePresence>
              {hoveredNode && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute top-4 left-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm pointer-events-none z-10"
                >
                  <h4 className="heading-5 mb-2">{hoveredNode.title}</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type:</span>
                      <span className="font-medium capitalize">
                        {hoveredNode.type.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Quality:</span>
                      <span className="font-medium">
                        {Math.round(hoveredNode.qualityScore * 100)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Comparability:</span>
                      <span className="font-medium">
                        {Math.round(hoveredNode.comparabilityScore * 100)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Sample Size:</span>
                      <span className="font-medium">{hoveredNode.sampleSize.toLocaleString()}</span>
                    </div>
                    {hoveredNode.isAnchorCandidate && (
                      <div className="mt-2 px-2 py-1 bg-success-100 text-success-700 rounded text-xs font-medium">
                        Anchor Candidate
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Zoom Level Indicator */}
            <div className="absolute bottom-4 right-4 bg-white border border-gray-200 rounded px-3 py-1 text-sm text-gray-600">
              Zoom: {Math.round(zoomLevel * 100)}%
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="card">
        <div className="card-header">
          <h3 className="heading-5">Legend</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Node Colors */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Node Colors ({viewMode})</h4>
              <div className="space-y-2">
                {viewMode === 'network' && (
                  <>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                      <span className="text-sm">Clinical Trial</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 rounded-full bg-purple-500"></div>
                      <span className="text-sm">Real World Evidence</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                      <span className="text-sm">Literature</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 rounded-full bg-green-600"></div>
                      <span className="text-sm">Anchor Candidate</span>
                    </div>
                  </>
                )}
                {viewMode === 'quality' && (
                  <div className="flex items-center space-x-2">
                    <div className="w-16 h-4 bg-gradient-to-r from-red-500 to-green-500 rounded"></div>
                    <span className="text-sm">Low → High Quality</span>
                  </div>
                )}
              </div>
            </div>

            {/* Node Sizes */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Node Sizes</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                  <span className="text-sm">Small sample size (&lt;100)</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                  <span className="text-sm">Medium sample size (100-1000)</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 rounded-full bg-gray-400"></div>
                  <span className="text-sm">Large sample size (&gt;1000)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EvidenceNetworkVisualization
