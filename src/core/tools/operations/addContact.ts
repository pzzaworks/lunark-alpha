import { Tool } from '../tools';
import { ethers } from 'ethers';
import { log } from '@/common/utils/log';
import prisma from '@/infrastructure/database/prisma';

interface AddContactArgs {
  name: string;
  address: string;
  notes?: string;
  networks?: string[];
  userId: string;
}

export const addContact: Tool<AddContactArgs> = {
  name: 'addContact',
  definition: {
    type: 'function',
    function: {
      name: 'addContact',
      description: 'Add a new contact to your address book',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the contact'
          },
          address: {
            type: 'string',
            description: 'Blockchain address of the contact'
          },
          notes: {
            type: 'string',
            description: 'Optional notes about the contact'
          },
          networks: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Optional list of blockchain networks this contact uses'
          },
          userId: {
            type: 'string',
            description: 'ID of the user adding the contact'
          }
        },
        required: ['name', 'address', 'userId']
      }
    }
  },
  instructions: `
    Add a new contact to your address book. You can specify:
    - Name: A friendly name to identify the contact
    - Address: Their blockchain address
    - Notes: Any additional information about the contact
    - Networks: Which blockchain networks they use
  `,
  async handler(args: AddContactArgs) {
    try {
      // Validate the blockchain address
      if (!ethers.isAddress(args.address)) {
        throw new Error('Invalid blockchain address');
      }

      // Check if contact with same name already exists
      const existingContact = await prisma.contact.findFirst({
        where: {
          userId: args.userId,
          name: args.name,
          deletedAt: null
        }
      });

      if (existingContact) {
        throw new Error(`Contact with name "${args.name}" already exists`);
      }

      // Create the contact
      const contact = await prisma.contact.create({
        data: {
          userId: args.userId,
          name: args.name,
          address: args.address,
          notes: args.notes,
          networks: args.networks || [],
          metadata: '{}'
        }
      });

      return {
        success: true,
        message: `${args.name} added successfully to your contacts.`,
        toolData: {
          type: 'contactAdd',
          data: {
            contact
          },
          component: 'contactAdd'
        }
      };

    } catch (error) {
      log('Error adding contact:', error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to add contact',
        error: {
          type: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to add contact',
          requiresLLMProcessing: true
        }
      };
    }
  }
}; 