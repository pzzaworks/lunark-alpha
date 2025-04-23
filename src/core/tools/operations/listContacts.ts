import { Tool } from '../tools';
import { log } from '@/common/utils/log';
import prisma from '@/infrastructure/database/prisma';

interface ListContactsArgs {
  userId: string;
}

export const listContacts: Tool<ListContactsArgs> = {
  name: 'listContacts',
  definition: {
    type: 'function',
    function: {
      name: 'listContacts',
      description: 'List all contacts in your address book',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'ID of the user whose contacts to list'
          }
        },
        required: ['userId']
      }
    }
  },
  instructions: `List all contacts in your address book, showing their names, addresses, and associated networks.`,
  async handler(args: ListContactsArgs) {
    try {
      // Get all active contacts for the user
      const contacts = await prisma.contact.findMany({
        where: {
          userId: args.userId,
          deletedAt: null
        },
        orderBy: {
          name: 'asc'
        }
      });

      if (contacts.length === 0) {
        return {
          success: true,
          message: 'You have no contacts in your address book yet.',
          toolData: {
            type: 'contactList',
            data: {
              contacts: []
            },
            component: 'contactList'
          }
        };
      }

      // Format contacts for display
      const formattedContacts = contacts.map(contact => ({
        id: contact.id,
        name: contact.name,
        address: contact.address,
        networks: contact.networks,
        notes: contact.notes
      }));

      // Create a natural language summary
      const summary = contacts.length === 1
        ? `You have 1 contact in your address book:`
        : `You have ${contacts.length} contacts in your address book:`;

      const contactList = formattedContacts
        .map(c => `- ${c.name} (${c.address})${c.networks.length ? ` on ${c.networks.join(', ')}` : ''}`)
        .join('\n');

      return {
        success: true,
        message: `${summary}\n${contactList}`,
        toolData: {
          type: 'contactList',
          data: {
            contacts: formattedContacts
          },
          component: 'contactList'
        }
      };

    } catch (error) {
      log('Error listing contacts:', error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to list contacts',
        error: {
          type: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to list contacts',
          requiresLLMProcessing: true
        }
      };
    }
  }
}; 