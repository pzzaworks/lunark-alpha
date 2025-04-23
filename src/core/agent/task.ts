import { ITask, createGraph, getGraphStatus } from './graph'
import { log } from '@/common/utils/log';
import prisma from '@/infrastructure/database/prisma';
import { encrypt, decrypt } from '@/common/utils/encrypt';

export async function createTask(data: Pick<ITask, 'title' | 'description' | 'createdBy' | 'priority' | 'chatId'>) {
 try {
   try {
     const user = await prisma.user.findUnique({
       where: { id: data.createdBy }
     });

     if (!user) {
       throw new Error('User not found');
     }
   } catch (error) {
     throw error;
   }

   try {
     const task = await prisma.task.create({
       data: {
         title: encrypt(data.title),
         description: encrypt(data.description),
         status: 'PLANNING',
         priority: data.priority,
         metadata: encrypt(JSON.stringify({
           createdAt: new Date(),
           lastUpdated: new Date(),
           progress: 0
         })),
         user: {
           connect: { id: data.createdBy }
         },
         chat: {
           connect: { id: data.chatId }
         }
       }
     });

     const processedTask = processTaskData(task);

     return processedTask;
   } catch (error) {
     throw error;
   }

 } catch (error) {
   throw error;
 }
}

export async function updateTask(taskId: string, data: { title?: string; description?: string; status?: string; priority?: number; deadline?: Date; graphId?: string; metadata?: Record<string, any>; }) {
 try {
   try {
     const task = await prisma.task.findUnique({
       where: { id: taskId },
       include: { graph: true }
     });

     if (!task) {
       throw new Error('Task not found');
     }

     const updateData: any = {
       updatedAt: new Date()
     };

     if (data.title) updateData.title = encrypt(data.title);
     if (data.description) updateData.description = encrypt(data.description);
     if (data.status) updateData.status = data.status;
     if (data.priority !== undefined) updateData.priority = data.priority;
     if (data.deadline) updateData.deadline = data.deadline;
     if (data.graphId) updateData.graphId = data.graphId;

     if (data.metadata) {
       const currentMetadata = task.metadata ? JSON.parse(decrypt(task.metadata)) : {};
       updateData.metadata = encrypt(JSON.stringify({
         ...currentMetadata,
         ...data.metadata,
         lastUpdated: new Date()
       }));
     }

     const updatedTask = await prisma.task.update({
       where: { id: taskId },
       data: updateData,
       include: {
         user: true,
         graph: {
           include: {
             nodes: {
               include: {
                 edges: true,
                 targetEdges: true
               }
             },
             edges: true
           }
         }
       }
     });

     return processTaskData(updatedTask);

   } catch (error) {
     throw error;
   }

 } catch (error) {
   throw error;
 }
}

export async function getTask(taskId: string) {
 try {
   const task = await prisma.task.findUnique({
     where: { id: taskId },
     include: {
       user: true,
       graph: {
         include: {
           nodes: {
             include: {
               edges: true,
               targetEdges: true
             }
           },
           edges: true
         }
       }
     }
   });

   if (!task) {
     return null;
   }

   return processTaskData(task);
 } catch (error) {
   throw error;
 }
}

export async function listTasks(userId: string) {
 try {
   const tasks = await prisma.task.findMany({
     where: { createdBy: userId },
     include: {
       user: true,
       graph: {
         include: {
           nodes: {
             include: {
               edges: true,
               targetEdges: true
             }
           },
           edges: true
         }
       }
     },
     orderBy: [
       { status: 'asc' },
       { priority: 'desc' },
       { createdAt: 'desc' }
     ]
   });

   return tasks.map(task => processTaskData(task));
 } catch (error) {
   throw error;
 }
}

export async function cancelTask(taskId: string) {
 try {
   try {
     const task = await prisma.task.findUnique({
       where: { id: taskId },
       include: { graph: true }
     });

     if (!task) {
       throw new Error('Task not found');
     }

     if (task.status === 'COMPLETED' || task.status === 'FAILED') {
       throw new Error('Cannot cancel completed or failed task');
     }

     const updatedTask = await prisma.$transaction(async (prisma) => {
       if (task.graphId) {
         await prisma.graph.update({
           where: { id: task.graphId },
           data: { 
             status: 'CANCELLED',
             metadata: encrypt(JSON.stringify({
               cancelledAt: new Date(),
               reason: 'Task cancelled by user'
             }))
           }
         });
       }

       return await prisma.task.update({
         where: { id: taskId },
         data: { 
           status: 'CANCELLED',
           metadata: encrypt(JSON.stringify({
             cancelledAt: new Date(),
             lastUpdated: new Date()
           }))
         },
         include: {
           user: true,
           graph: true
         }
       });
     });

     return processTaskData(updatedTask);

   } catch (error) {
     throw error;
   }

 } catch (error) {
   throw error;
 }
}

export async function deleteTask(taskId: string) {
 try {
   try {
     const task = await prisma.task.findUnique({
       where: { id: taskId },
       include: {
         graph: {
           include: {
             nodes: true,
             edges: true
           }
         }
       }
     });

     if (!task) {
       throw new Error('Task not found');
     }

     await prisma.$transaction(async (prisma) => {
       if (task.graphId) {
         await prisma.edge.deleteMany({
           where: { graphId: task.graphId }
         });
         await prisma.node.deleteMany({
           where: { graphId: task.graphId }
         });
         await prisma.graph.delete({
           where: { id: task.graphId }
         });
       }
       
       await prisma.task.delete({
         where: { id: taskId }
       });
     });

     return processTaskData(task);

   } catch (error) {
     throw error;
   }

 } catch (error) {
   throw error;
 }
}

export async function retryTask(taskId: string) {
 try {
   try {
     const task = await prisma.task.findUnique({
       where: { id: taskId },
       include: { graph: true }
     });

     if (!task) {
       throw new Error('Task not found');
     }

     if (task.status !== 'FAILED') {
       throw new Error('Can only retry failed tasks');
     }

     const updatedTask = await prisma.$transaction(async (prisma) => {
       if (task.graphId) {
         await prisma.edge.deleteMany({
           where: { graphId: task.graphId }
         });
         await prisma.node.deleteMany({
           where: { graphId: task.graphId }
         });
         await prisma.graph.delete({
           where: { id: task.graphId }
         });
       }

       return await prisma.task.update({
         where: { id: taskId },
         data: { 
           status: 'PLANNING',
           graphId: null,
           metadata: encrypt(JSON.stringify({
             retriedAt: new Date(),
             lastUpdated: new Date(),
             previousFailures: (task.metadata ? 
               JSON.parse(decrypt(task.metadata)).previousFailures || 0 : 0) + 1
           }))
         },
         include: {
           user: true,
           graph: true
         }
       });
     });

     return processTaskData(updatedTask);

   } catch (error) {
     throw error;
   }

 } catch (error) {
   throw error;
 }
}

export async function getTaskProgress(taskId: string) {
 try {
   try {
     const task = await prisma.task.findUnique({
       where: { id: taskId },
       include: {
         graph: {
           include: {
             nodes: true
           }
         }
       }
     });

     if (!task) {
       throw new Error('Task not found');
     }

     if (!task.graphId) {
       return {
         total: 0,
         completed: 0,
         failed: 0,
         progress: 0,
         task: processTaskData(task)
       };
     }

     const graphStatus = await getGraphStatus(task.graphId);
     
     await prisma.task.update({
       where: { id: taskId },
       data: {
         metadata: encrypt(JSON.stringify({
           ...JSON.parse(decrypt(task.metadata || '{}')),
           progress: graphStatus.progress,
           lastUpdated: new Date()
         }))
       }
     });

     return {
       ...graphStatus,
       task: processTaskData(task)
     };

   } catch (error) {
     throw error;
   }

 } catch (error) {
   throw error;
 }
}

function processTaskData(task: any) {
 return {
   ...task,
   title: decrypt(task.title),
   description: decrypt(task.description),
   metadata: task.metadata ? JSON.parse(decrypt(task.metadata)) : null,
   graph: task.graph ? {
     ...task.graph,
     metadata: task.graph.metadata ? 
       JSON.parse(decrypt(task.graph.metadata)) : null,
     nodes: task.graph.nodes?.map((node: any) => ({
       ...node,
       data: decrypt(node.data),
       metadata: node.metadata ? 
         JSON.parse(decrypt(node.metadata)) : null
     }))
   } : null
 };
}