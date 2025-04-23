import { log } from '@/common/utils/log';
import prisma from '@/infrastructure/database/prisma';
import { encrypt, decrypt } from '@/common/utils/encrypt';

const VALID_NODE_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'BLOCKED'];

interface GraphMetadata {
  progress: number;
  completedNodes: number;
  failedNodes: number;
  totalNodes: number;
  lastUpdated: Date;
  createdAt?: Date;
}

export interface Node {
  id: string;
  type: string;
  data: string;
  metadata?: string | null;
  status: string;
  graphId: string;
  createdAt: Date;
  updatedAt: Date;
  edges: IEdge[];
  targetEdges: IEdge[];
}

export interface INode {
  id: string;
  type: string;
  data: string;
  metadata?: string | null;
  status: string;
  graph?: IGraph;
  graphId: string;
  createdAt: Date;
  updatedAt: Date;
  edges: IEdge[];
  targetEdges: IEdge[];
}

export interface IEdge {
  id: string;
  type: string;
  source?: INode;
  sourceId: string;
  target?: INode;
  targetId: string;
  metadata?: string | null;
  createdAt: Date;
  updatedAt: Date;
  graph?: IGraph;
  graphId: string;
}

export interface IGraph {
  id: string;
  nodes: INode[];
  edges: IEdge[];
  tasks: ITask[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ITask {
  id: string;
  title: string;
  description: string;
  createdBy: string;
  chatId: string;
  status: string;
  priority: number;
  graphId?: string | null;
  deadline?: Date | null;
  metadata?: string | null;
  createdAt: Date;
  updatedAt: Date;
  graph?: IGraph | null;
}

async function validateGraphStatus(graphId: string) {
  try {
    try {
      const graph = await prisma.graph.findUnique({
        where: { id: graphId },
        include: { nodes: true }
      });

      if (!graph) {
        throw new Error(`Graph not found: ${graphId}`);
      }

      const actualCounts = {
        total: graph.nodes.length,
        completed: graph.nodes.filter(n => n.status === 'COMPLETED').length,
        failed: graph.nodes.filter(n => n.status === 'FAILED').length,
        pending: graph.nodes.filter(n => n.status === 'PENDING').length,
        blocked: graph.nodes.filter(n => n.status === 'BLOCKED').length,
        inProgress: graph.nodes.filter(n => n.status === 'IN_PROGRESS').length
      };

      let metadata: GraphMetadata;
      try {
        metadata = graph.metadata ? JSON.parse(decrypt(graph.metadata)) : {
          progress: 0,
          completedNodes: 0,
          failedNodes: 0,
          totalNodes: actualCounts.total,
          lastUpdated: new Date(),
          createdAt: graph.createdAt
        };
      } catch (error) {
        metadata = {
          progress: 0,
          completedNodes: 0,
          failedNodes: 0,
          totalNodes: actualCounts.total,
          lastUpdated: new Date(),
          createdAt: graph.createdAt
        };
      }

      const progress = Math.round(((actualCounts.completed + actualCounts.failed) / actualCounts.total) * 100) || 0;

      if (actualCounts.completed + actualCounts.failed + actualCounts.pending + 
          actualCounts.blocked + actualCounts.inProgress !== actualCounts.total) {

        const updatedMetadata: GraphMetadata = {
          progress,
          completedNodes: actualCounts.completed,
          failedNodes: actualCounts.failed,
          totalNodes: actualCounts.total,
          lastUpdated: new Date(),
          createdAt: metadata.createdAt
        };

        await prisma.graph.update({
          where: { id: graphId },
          data: { metadata: encrypt(JSON.stringify(updatedMetadata)) }
        });
        metadata = updatedMetadata;
      }

      return {
        graphId,
        status: graph.status as 'ACTIVE' | 'COMPLETED' | 'FAILED',
        progress,
        total: actualCounts.total,
        completed: actualCounts.completed,
        failed: actualCounts.failed,
        pending: actualCounts.pending,
        blocked: actualCounts.blocked,
        lastUpdated: metadata.lastUpdated ? new Date(metadata.lastUpdated).toISOString() : new Date().toISOString()
      };

    } catch (error) {
      throw error;
    }
  } catch (error) {
    throw error;
  }
}

export async function createGraph() {

  return await prisma.$transaction(async (tx) => {
    try {
      try {
        const graph = await tx.graph.create({
          data: {
            status: 'ACTIVE',
            metadata: encrypt(JSON.stringify({
              progress: 0,
              completedNodes: 0,
              failedNodes: 0,
              totalNodes: 0,
              createdAt: new Date(),
              lastUpdated: new Date()
            }))
          }
        });

        return graph;
      } catch (error) {
        throw error;
      }
    } catch (error) {
      throw error;
    }
  });
}

export async function createNode(
  type: string,
  data: string,
  graphId: string,
  metadata?: Record<string, any>,
  dependencies: string[] = []
) {
  return await prisma.$transaction(async (tx) => {
    try {
      try {
        const graph = await tx.graph.findUnique({
          where: { id: graphId },
          include: { nodes: true }
        });

        if (!graph) {
          throw new Error(`Graph not found: ${graphId}`);
        }

        if (graph.status !== 'ACTIVE') {
          throw new Error(`Cannot add node to ${graph.status} graph`);
        }

        const initialStatus = dependencies.length === 0 ? 'PENDING' : 'BLOCKED';

        const node = await tx.node.create({
          data: {
            type,
            data: encrypt(data),
            metadata: metadata ? encrypt(JSON.stringify({
              ...metadata,
              createdAt: new Date(),
              lastUpdated: new Date()
            })) : undefined,
            graphId,
            status: initialStatus
          }
        });

        if (dependencies.length > 0) {
          await Promise.all(dependencies.map(dependencyId =>
            createEdge('DEPENDS_ON', dependencyId, node.id, graphId)
          ));
        }

        const updatedMetadata: GraphMetadata = {
          progress: 0,
          completedNodes: graph.nodes.filter(n => n.status === 'COMPLETED').length,
          failedNodes: graph.nodes.filter(n => n.status === 'FAILED').length,
          totalNodes: graph.nodes.length + 1,
          lastUpdated: new Date(),
          createdAt: graph.createdAt
        };

        await tx.graph.update({
          where: { id: graphId },
          data: { metadata: encrypt(JSON.stringify(updatedMetadata)) }
        });

        return node;
      } catch (error) {
        throw error;
      }
    } catch (error) {
      throw error;
    }
  });
}

export async function createEdge(
  type: string,
  sourceId: string,
  targetId: string,
  graphId: string,
  metadata?: Record<string, any>
) {
  return await prisma.$transaction(async (tx) => {
    try {
      try {
        const [source, target, graph] = await Promise.all([
          tx.node.findUnique({ where: { id: sourceId } }),
          tx.node.findUnique({ where: { id: targetId } }),
          tx.graph.findUnique({ where: { id: graphId } })
        ]);

        if (!source || !target) {
          throw new Error('Source or target node not found');
        }

        if (!graph || graph.status !== 'ACTIVE') {
          throw new Error('Graph not found or not active');
        }

        const edge = await tx.edge.create({
          data: {
            type,
            sourceId,
            targetId,
            graphId,
            metadata: metadata ? encrypt(JSON.stringify({
              ...metadata,
              createdAt: new Date(),
              lastUpdated: new Date()
            })) : undefined
          }
        });

        return edge;
      } catch (error) {
        throw error;
      }
    } catch (error) {
      throw error;
    }
  });
}

export async function updateNodeStatus(
  nodeId: string,
  status: string,
  result?: Record<string, any>
) {

  if (!VALID_NODE_STATUSES.includes(status)) {
    throw new Error(`Invalid node status: ${status}`);
  }

  return await prisma.$transaction(async (tx) => {
    try {
      try {
        const node = await tx.node.findUnique({
          where: { id: nodeId },
          include: {
            graph: true,
            edges: {
              include: {
                target: true
              }
            }
          }
        });

        if (!node) {
          throw new Error('Node not found');
        }

        const updatedNode = await tx.node.update({
          where: { id: nodeId },
          data: {
            status,
            metadata: result ? encrypt(JSON.stringify({
              ...result,
              completedAt: status === 'COMPLETED' ? new Date() : undefined,
              failedAt: status === 'FAILED' ? new Date() : undefined,
              lastUpdated: new Date()
            })) : undefined
          }
        });

        if (status === 'COMPLETED' || status === 'FAILED') {
          const edges = await tx.edge.findMany({
            where: { sourceId: nodeId },
            include: {
              target: {
                include: {
                  targetEdges: {
                    include: {
                      source: true
                    }
                  }
                }
              }
            }
          });

          for (const edge of edges) {
            const targetNode = edge.target;
            const dependencies = targetNode.targetEdges;
            
            const allDependenciesCompleted = dependencies.every(
              dep => dep.source.status === 'COMPLETED'
            );

            if (allDependenciesCompleted) {
              await tx.node.update({
                where: { id: targetNode.id },
                data: { status: 'PENDING' }
              });
            }
          }

          const graphStatus = await validateGraphStatus(node.graphId);
          let newGraphStatus = node.graph.status;

          if (graphStatus.failed > 0) {
            newGraphStatus = 'FAILED';
          } else if (graphStatus.completed === graphStatus.total) {
            newGraphStatus = 'COMPLETED';
          }

          if (newGraphStatus !== node.graph.status) {
            await tx.graph.update({
              where: { id: node.graphId },
              data: { status: newGraphStatus }
            });
          }
        }

        return updatedNode;
      } catch (error) {
        throw error;
      }
    } catch (error) {
      throw error;
    }
  });
}

export async function getGraphStatus(graphId: string) {
  try {
    try {
      const status = await validateGraphStatus(graphId);
      return status;
    } catch (error) {
      throw error;
    }
  } catch (error) {
    throw error;
  }
}

function mapNodeFromDb(dbNode: any): Node {
  return {
    id: dbNode.id,
    type: dbNode.type,
    data: decrypt(dbNode.data),
    metadata: dbNode.metadata ? JSON.parse(decrypt(dbNode.metadata)) : null,
    status: dbNode.status,
    graphId: dbNode.graphId,
    createdAt: dbNode.createdAt,
    updatedAt: dbNode.updatedAt,
    edges: dbNode.edges.map((edge: any) => ({
      id: edge.id,
      type: edge.type,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      metadata: edge.metadata ? JSON.parse(decrypt(edge.metadata)) : null,
      createdAt: edge.createdAt,
      updatedAt: edge.updatedAt,
      graphId: edge.graphId,
      source: edge.source ? mapNodeFromDb(edge.source) : undefined,
      target: edge.target ? mapNodeFromDb(edge.target) : undefined
    })),
    targetEdges: dbNode.targetEdges.map((edge: any) => ({
      id: edge.id,
      type: edge.type,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      metadata: edge.metadata ? JSON.parse(decrypt(edge.metadata)) : null,
      createdAt: edge.createdAt,
      updatedAt: edge.updatedAt,
      graphId: edge.graphId,
      source: edge.source ? mapNodeFromDb(edge.source) : undefined,
      target: edge.target ? mapNodeFromDb(edge.target) : undefined
    }))
  };
}

export async function getExecutableNodes(graphId: string): Promise<Node[]> {
  try {
    const graph = await prisma.graph.findUnique({
      where: { id: graphId },
      include: {
        nodes: {
          include: {
            edges: {
              include: {
                source: true,
                target: true
              }
            },
            targetEdges: {
              include: {
                source: true,
                target: true
              }
            }
          }
        }
      }
    });

    if (!graph) {
      throw new Error(`Graph not found: ${graphId}`);
    }

    const executableNodes = graph.nodes.filter(node => 
      node.status === 'PENDING' && 
      node.targetEdges.every(edge => 
        edge.source && edge.source.status === 'COMPLETED'
      )
    );

    return executableNodes.map(mapNodeFromDb);
  } catch (error) {
    throw error;
  }
}

export async function getCurrentGraph() {
  try {
    try {
      const graph = await prisma.graph.findFirst({
        where: {
          status: 'ACTIVE'
        },
        orderBy: { createdAt: 'desc' },
        include: {
          nodes: {
            include: {
              edges: true,
              targetEdges: true
            }
          },
          edges: true
        }
      });

      if (!graph) {
        return null;
      }

      await validateGraphStatus(graph.id);

      const decryptedGraph = {
        ...graph,
        metadata: graph.metadata ? JSON.parse(decrypt(graph.metadata)) : null,
        nodes: graph.nodes.map(node => ({
          ...node,
          data: decrypt(node.data),
          metadata: node.metadata ? JSON.parse(decrypt(node.metadata)) : null
        }))
      };

      return decryptedGraph;
    } catch (error) {
      throw error;
    }
  } catch (error) {
    return null;
  }
}