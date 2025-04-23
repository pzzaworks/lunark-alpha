import { Tool } from '../tools';
import { ethers } from 'ethers';
import { log } from '@/common/utils/log';
import prisma from '@/infrastructure/database/prisma';

interface UpdateContactArgs {
  id: string;
  userId: string;
  name?: string;
  address?: string;
  notes?: string;
  networks?: string[];
}

export const updateContact: Tool<UpdateContactArgs> = {
  name: 'updateContact',
  definition: {
    type: 'function',
    function: {
      name: 'updateContact',
      description: 'Update an existing contact in your address book',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'ID of the contact to update'
          },
          userId: {
            type: 'string',
            description: 'ID of the user updating the contact'
          },
          name: {
            type: 'string',
            description: 'New name for the contact'
          },
          address: {
            type: 'string',
            description: 'New blockchain address for the contact'
          },
          notes: {
            type: 'string',
            description: 'New notes about the contact'
          },
          networks: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'New list of blockchain networks this contact uses'
          }
        },
        required: ['id', 'userId']
      }
    }
  },
  instructions: `
    Update an existing contact in your address book. You can update:
    - Name: A friendly name to identify the contact
    - Address: Their blockchain address
    - Notes: Any additional information about the contact
    - Networks: Which blockchain networks they use
  `,
  async handler(args: UpdateContactArgs) {
    try {
      // Validate the blockchain address if provided
      if (args.address && !ethers.isAddress(args.address)) {
        throw new Error('Invalid blockchain address');
      }

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

      // If name is being updated, check for duplicates
      if (args.name && args.name !== existingContact.name) {
        const duplicateName = await prisma.contact.findFirst({
          where: {
            userId: args.userId,
            name: args.name,
            deletedAt: null,
            id: { not: args.id } // Exclude current contact
          }
        });

        if (duplicateName) {
          throw new Error(`Contact with name "${args.name}" already exists`);
        }
      }

      // Update the contact
      const contact = await prisma.contact.update({
        where: {
          id: args.id,
          userId: args.userId,
          deletedAt: null
        },
        data: {
          name: args.name,
          address: args.address,
          notes: args.notes,
          networks: args.networks,
          updatedAt: new Date()
        }
      });

      return {
        success: true,
        message: `${contact.name} updated successfully.`,
        toolData: {
          type: 'contactUpdate',
          data: {
            contact
          },
          component: 'contactUpdate'
        }
      };

    } catch (error) {
      log('Error updating contact:', error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update contact',
        error: {
          type: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update contact',
          requiresLLMProcessing: true
        }
      };
    }
  }
}; 