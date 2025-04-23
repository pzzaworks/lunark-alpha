import { Tool } from '../tools';
import { log } from '@/common/utils/log';
import prisma from '@/infrastructure/database/prisma';

interface DeleteContactArgs {
  id: string;
  userId: string;
}

export const deleteContact: Tool<DeleteContactArgs> = {
  name: 'deleteContact',
  definition: {
    type: 'function',
    function: {
      name: 'deleteContact',
      description: 'Delete a contact from your address book',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'ID of the contact to delete'
          },
          userId: {
            type: 'string',
            description: 'ID of the user deleting the contact'
          }
        },
        required: ['id', 'userId']
      }
    }
  },
  instructions: `Delete a contact from your address book. This is a soft delete - the contact's transaction history will be preserved.`,
  async handler(args: DeleteContactArgs) {
    try {
      // Check if contact exists
      const existingContact = await prisma.contact.findFirst({
        where: {
          id: args.id,
          userId: args.userId,
          deletedAt: null
        }
      });

      if (!existingContact) {
        throw new Error('Contact not found');
      }

      // Soft delete the contact
      const contact = await prisma.contact.update({
        where: {
          id: args.id,
          userId: args.userId,
          deletedAt: null
        },
        data: {
          deletedAt: new Date()
        }
      });

      return {
        success: true,
        message: `${contact.name} removed successfully from your contacts.`,
        toolData: {
          type: 'contactDelete',
          data: {
            contact
          },
          component: 'contactDelete'
        }
      };

    } catch (error) {
      log('Error deleting contact:', error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete contact',
        error: {
          type: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to delete contact',
          requiresLLMProcessing: true
        }
      };
    }
  }
}; 