import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Flag, Trash2, Save, Archive, Eye, EyeOff, SortAsc, Star } from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';
import { AVAILABLE_TAGS } from '../Layout';

interface ContentItem {
  id: string;
  type: 'story' | 'comment';
  title?: string;
  content: string;
  author: string;
  createdAt: Date;
  reported?: boolean;
  customMessage?: string;
  hidden?: boolean;
  archived?: boolean;
  screenshot?: string;
  votes?: number;
  rating?: number;
  tags?: string[];
}

// Mock data with custom messages
const MOCK_CONTENT: ContentItem[] = [
  {
    id: '1',
    type: 'story',
    title: 'Building a Lobste.rs Clone',
    content: 'A detailed guide on building...',
    author: 'johndoe',
    createdAt: new Date(),
    reported: true,
    customMessage: 'Featured submission of the week!',
    votes: 42,
    rating: 4.5,
    tags: ['technology', 'programming']
  },
  {
    id: '2',
    type: 'comment',
    content: 'This is a reported comment that needs moderation...',
    author: 'user123',
    createdAt: new Date(Date.now() - 3600000),
    reported: true
  },
];

// Mock comments data
const MOCK_COMMENTS: ContentItem[] = [
  {
    id: 'c1',
    type: 'comment',
    content: 'This is a comment that needs moderation...',
    author: 'user456',
    createdAt: new Date(),
    reported: true
  },
  {
    id: 'c2',
    type: 'comment',
    content: 'Another comment flagged for review',
    author: 'user789',
    createdAt: new Date(Date.now() - 7200000),
    reported: true
  },
];

type SortField = 'createdAt' | 'votes' | 'rating';
type SortOrder = 'asc' | 'desc';

export function ContentModeration() {
  const [content, setContent] = React.useState<ContentItem[]>(MOCK_CONTENT);
  const [comments, setComments] = React.useState<ContentItem[]>(MOCK_COMMENTS);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [sortField, setSortField] = React.useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = React.useState<SortOrder>('desc');

  const handleDelete = (id: string, type: 'submission' | 'comment') => {
    if (type === 'submission') {
      setContent(content.filter(item => item.id !== id));
    } else {
      setComments(comments.filter(comment => comment.id !== id));
    }
  };

  const handleArchive = (id: string, type: 'submission' | 'comment') => {
    if (type === 'submission') {
      setContent(content.map(item =>
        item.id === id ? { ...item, archived: !item.archived } : item
      ));
    } else {
      setComments(comments.map(comment =>
        comment.id === id ? { ...comment, archived: !comment.archived } : comment
      ));
    }
  };

  const handleVisibility = (id: string, type: 'submission' | 'comment') => {
    if (type === 'submission') {
      setContent(content.map(item =>
        item.id === id ? { ...item, hidden: !item.hidden } : item
      ));
    } else {
      setComments(comments.map(comment =>
        comment.id === id ? { ...comment, hidden: !comment.hidden } : comment
      ));
    }
  };

  const handleApprove = (id: string, type: 'submission' | 'comment') => {
    if (type === 'submission') {
      setContent(content.map(item => 
        item.id === id ? { ...item, reported: false } : item
      ));
    } else {
      setComments(comments.map(comment =>
        comment.id === id ? { ...comment, reported: false } : comment
      ));
    }
  };

  const handleCustomMessageChange = (id: string, message: string) => {
    setContent(content.map(item =>
      item.id === id ? { ...item, customMessage: message } : item
    ));
  };

  const handleSaveMessage = async (id: string) => {
    setSavingId(id);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const updatedContent = content.map(item => {
        if (item.id === id) {
          return {
            ...item,
            customMessage: item.customMessage?.trim() || undefined,
          };
        }
        return item;
      });
      setContent(updatedContent);
      console.log('Custom message saved:', {
        storyId: id,
        message: updatedContent.find(item => item.id === id)?.customMessage,
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(order => order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const sortContent = (items: ContentItem[]) => {
    return [...items].sort((a, b) => {
      const aValue = a[sortField] || 0;
      const bValue = b[sortField] || 0;
      const multiplier = sortOrder === 'asc' ? 1 : -1;
      return (aValue > bValue ? 1 : -1) * multiplier;
    });
  };

  const filterContent = (items: ContentItem[]) => {
    return items.filter(item => {
      const matchesSearch = !searchQuery || 
        item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.author.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesTags = selectedTags.length === 0 ||
        (item.tags && selectedTags.every(tag => item.tags.includes(tag)));

      return item.reported && matchesSearch && matchesTags;
    });
  };

  const filteredContent = filterContent(sortContent(content));
  const filteredComments = filterContent(sortContent(comments));

  const renderContentItem = (item: ContentItem, type: 'submission' | 'comment') => (
    <div key={item.id} className="border-b border-[#F4F0ED] pb-4">
      <div className="flex items-start justify-between">
        <div>
          {item.type === 'story' && (
            <>
              <h3 className="font-medium text-[#525252]">{item.title}</h3>
              {item.screenshot && (
                <div className="mt-2 mb-4 rounded-md overflow-hidden">
                  <img 
                    src={item.screenshot} 
                    alt={item.title} 
                    className="w-full max-h-48 object-cover"
                  />
                </div>
              )}
            </>
          )}
          <p className="text-[#787672] mt-1">{item.content}</p>
          <div className="flex items-center gap-4 mt-2 text-sm text-[#787672]">
            <span>{item.author}</span>
            <span>{formatDistanceToNow(item.createdAt)} ago</span>
            {item.votes !== undefined && (
              <span className="flex items-center gap-1">
                <SortAsc className="w-4 h-4" /> {item.votes}
              </span>
            )}
            {item.rating !== undefined && (
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4" /> {item.rating.toFixed(1)}
              </span>
            )}
            <span className="flex items-center gap-1">
              {item.type === 'comment' ? <MessageSquare className="w-4 h-4" /> : <Flag className="w-4 h-4" />}
              {item.type}
            </span>
            {item.hidden && <span className="text-[#787672]">(Hidden)</span>}
            {item.archived && <span className="text-[#787672]">(Archived)</span>}
          </div>
          {item.tags && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {item.tags.map(tag => (
                <span key={tag} className="text-sm text-[#787672] bg-[#F4F0ED] px-2 py-1 rounded">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleVisibility(item.id, type)}
            className="text-[#787672] hover:text-[#525252]"
            title={item.hidden ? "Show" : "Hide"}
          >
            {item.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button
            onClick={() => handleArchive(item.id, type)}
            className="text-[#787672] hover:text-[#525252]"
            title={item.archived ? "Unarchive" : "Archive"}
          >
            <Archive className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleApprove(item.id, type)}
            className="px-3 py-1 bg-[#F4F0ED] text-[#525252] rounded-[4px] hover:bg-[#e5e1de] transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => handleDelete(item.id, type)}
            className="text-[#787672] hover:text-[#525252]"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {type === 'submission' && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-[#525252]">Custom Message</label>
            <button
              onClick={() => handleSaveMessage(item.id)}
              disabled={savingId === item.id}
              className="text-[#787672] hover:text-[#525252] flex items-center gap-1 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {savingId === item.id ? 'Saving...' : 'Save'}
            </button>
          </div>
          <textarea
            value={item.customMessage || ''}
            onChange={(e) => handleCustomMessageChange(item.id, e.target.value)}
            placeholder="Add a custom message for this post..."
            className="w-full px-3 py-2 bg-white border border-[#F4F0ED] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825] min-h-[60px]"
          />
          {item.customMessage && (
            <div className="mt-2 text-[#787671] bg-[#F3F0ED] border border-[#D5D3D0] rounded-md p-4">
              {item.customMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6">
        <Tabs.Root defaultValue="submissions" className="space-y-6">
          <Tabs.List className="flex gap-4 border-b border-[#F4F0ED] mb-6">
            <Tabs.Trigger
              value="submissions"
              className="px-4 py-2 text-[#787672] hover:text-[#525252] data-[state=active]:text-[#2A2825] data-[state=active]:border-b-2 data-[state=active]:border-[#2A2825]"
            >
              Submissions
            </Tabs.Trigger>
            <Tabs.Trigger
              value="comments"
              className="px-4 py-2 text-[#787672] hover:text-[#525252] data-[state=active]:text-[#2A2825] data-[state=active]:border-b-2 data-[state=active]:border-[#2A2825]"
            >
              Comments
            </Tabs.Trigger>
          </Tabs.List>

          <div className="space-y-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search content..."
              className="w-full px-3 py-2 bg-white border border-[#F4F0ED] rounded-md text-[#525252] focus:outline-none focus:ring-1 focus:ring-[#2A2825]"
            />

            <div className="flex flex-wrap gap-2 mb-4">
              {AVAILABLE_TAGS.map(tag => (
                <button
                  key={tag.name}
                  onClick={() => toggleTag(tag.name)}
                  className={`px-3 py-1 rounded-md text-sm ${
                    selectedTags.includes(tag.name)
                      ? 'bg-[#F4F0ED] text-[#2A2825]'
                      : 'text-[#787672] hover:text-[#525252]'
                  }`}
                >
                  {tag.name}
                </button>
              ))}
            </div>

            <div className="flex gap-4 mb-4">
              <button
                onClick={() => handleSort('createdAt')}
                className={`px-3 py-1 rounded-md text-sm ${
                  sortField === 'createdAt' ? 'bg-[#F4F0ED] text-[#2A2825]' : 'text-[#787672]'
                }`}
              >
                Date {sortField === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button
                onClick={() => handleSort('votes')}
                className={`px-3 py-1 rounded-md text-sm ${
                  sortField === 'votes' ? 'bg-[#F4F0ED] text-[#2A2825]' : 'text-[#787672]'
                }`}
              >
                Votes {sortField === 'votes' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button
                onClick={() => handleSort('rating')}
                className={`px-3 py-1 rounded-md text-sm ${
                  sortField === 'rating' ? 'bg-[#F4F0ED] text-[#2A2825]' : 'text-[#787672]'
                }`}
              >
                Rating {sortField === 'rating' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
            </div>
          </div>

          <Tabs.Content value="submissions" className="space-y-4">
            {filteredContent.map(item => renderContentItem(item, 'submission'))}
          </Tabs.Content>

          <Tabs.Content value="comments" className="space-y-4">
            {filteredComments.map(item => renderContentItem(item, 'comment'))}
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}