import $ from 'jquery';
import {wrap} from '@girder/core/utilities/PluginUtils';

import _ from 'underscore';

import View from '@girder/core/views/View';
import {AccessType} from '@girder/core/constants';
import {confirm} from '@girder/core/dialog';
import events from '@girder/core/events';
import {localeSort} from '@girder/core/misc';

import JsonMetadatumEditWidgetTemplate from '@girder/core/templates/widgets/jsonMetadatumEditWidget.pug';

import MetadatumEditWidgetTemplate from '@girder/core/templates/widgets/metadatumEditWidget.pug';

import '@girder/core/stylesheets/widgets/metadataWidget.styl';

import JSONEditor from 'jsoneditor/dist/jsoneditor.js'; // can't 'jsoneditor'
import 'jsoneditor/dist/jsoneditor.css';

import 'bootstrap/js/dropdown';

import MetadataWidget from '@girder/core/views/widgets/MetadataWidget';

import MetadataWidgetTemplate from '../templates/metadataWidget.pug';
import largeImageConfig from './configView';

function getMetadataRecord(item, fieldName) {
    if (item[fieldName]) {
        return item[fieldName];
    }
    let meta = item.attributes;
    fieldName.split('.').forEach((part) => {
        if (!meta[part]) {
            meta[part] = {};
        }
        meta = meta[part];
    });
    return meta;
}

var MetadatumWidget = View.extend({
    className: 'g-widget-metadata-row',

    events: {
        'click .g-widget-metadata-edit-button': 'editMetadata'
    },

    initialize: function (settings) {
        if (!_.has(this.parentView.modes, settings.mode)) {
            throw new Error('Unsupported metadatum mode ' + settings.mode + ' detected.');
        }

        this.mode = settings.mode;
        this.key = settings.key;
        this.value = settings.value;
        this.accessLevel = settings.accessLevel;
        this.parentView = settings.parentView;
        this.fieldName = settings.fieldName;
        this.apiPath = settings.apiPath;
        this.noSave = settings.noSave;
        this.onMetadataEdited = settings.onMetadataEdited;
        this.onMetadataAdded = settings.onMetadataAdded;
    },

    _validate: function (from, to, value) {
        var newMode = this.parentView.modes[to];

        if (_.has(newMode, 'validation') &&
            _.has(newMode.validation, 'from') &&
            _.has(newMode.validation.from, from)) {
            var validate = newMode.validation.from[from][0];
            var msg = newMode.validation.from[from][1];

            if (!validate(value)) {
                events.trigger('g:alert', {
                    text: msg,
                    type: 'warning'
                });
                return false;
            }
        }

        return true;
    },

    // @todo too much duplication with editMetadata
    toggleEditor: function (event, newEditorMode, existingEditor, overrides) {
        var fromEditorMode = (existingEditor instanceof JsonMetadatumEditWidget) ? 'json' : 'simple';
        var newValue = (overrides || {}).value || existingEditor.$el.attr('g-value');
        if (!this._validate(fromEditorMode, newEditorMode, newValue)) {
            return;
        }

        var row = existingEditor.$el;
        existingEditor.destroy();
        row.addClass('editing').empty();

        var opts = _.extend({
            el: row,
            item: this.parentView.item,
            key: row.attr('g-key'),
            value: row.attr('g-value'),
            accessLevel: this.accessLevel,
            newDatum: false,
            parentView: this,
            fieldName: this.fieldName,
            apiPath: this.apiPath,
            noSave: this.noSave,
            onMetadataEdited: this.onMetadataEdited,
            onMetadataAdded: this.onMetadataAdded
        }, overrides || {});

        this.parentView.modes[newEditorMode].editor(opts).render();
    },

    editMetadata: function (event) {
        this.$el.addClass('editing');
        this.$el.empty();

        var opts = {
            item: this.parentView.item,
            key: this.$el.attr('g-key'),
            value: this.$el.attr('g-value'),
            accessLevel: this.accessLevel,
            newDatum: false,
            parentView: this,
            fieldName: this.fieldName,
            apiPath: this.apiPath,
            noSave: this.noSave,
            onMetadataEdited: this.onMetadataEdited,
            onMetadataAdded: this.onMetadataAdded
        };

        // If they're trying to open false, null, 6, etc which are not stored as strings
        if (this.mode === 'json') {
            try {
                var jsonValue = JSON.parse(this.$el.attr('g-value'));

                if (jsonValue !== undefined && !_.isObject(jsonValue)) {
                    opts.value = jsonValue;
                }
            } catch (e) {}
        }

        this.parentView.modes[this.mode].editor(opts)
            .render()
            .$el.appendTo(this.$el);
    },

    render: function () {
        this.$el.attr({
            'g-key': this.key,
            'g-value': _.bind(this.parentView.modes[this.mode].displayValue, this)()
        }).empty();

        this.$el.html(this.parentView.modes[this.mode].template({
            key: this.key,
            value: _.bind(this.parentView.modes[this.mode].displayValue, this)(),
            accessLevel: this.accessLevel,
            AccessType
        }));

        return this;
    }
});

var MetadatumEditWidget = View.extend({
    events: {
        'click .g-widget-metadata-cancel-button': 'cancelEdit',
        'click .g-widget-metadata-save-button': 'save',
        'click .g-widget-metadata-delete-button': 'deleteMetadatum',
        'click .g-widget-metadata-toggle-button': function (event) {
            var editorType;
            // @todo modal
            // in the future this event will have the new editorType (assuming a dropdown)
            if (this instanceof JsonMetadatumEditWidget) {
                editorType = 'simple';
            } else {
                editorType = 'json';
            }

            this.parentView.toggleEditor(event, editorType, this, {
                // Save state before toggling editor
                key: this.$el.find('.g-widget-metadata-key-input').val(),
                value: this.getCurrentValue()
            });
            return false;
        }
    },

    initialize: function (settings) {
        this.item = settings.item;
        this.key = settings.key || '';
        this.fieldName = settings.fieldName || 'meta';
        this.value = (settings.value !== undefined) ? settings.value : '';
        this.accessLevel = settings.accessLevel;
        this.newDatum = settings.newDatum;
        this.fieldName = settings.fieldName;
        this.apiPath = settings.apiPath;
        this.noSave = settings.noSave;
        this.onMetadataEdited = settings.onMetadataEdited;
        this.onMetadataAdded = settings.onMetadataAdded;
    },

    editTemplate: MetadatumEditWidgetTemplate,

    getCurrentValue: function () {
        return this.$el.find('.g-widget-metadata-value-input').val();
    },

    deleteMetadatum: function (event) {
        event.stopImmediatePropagation();
        const target = $(event.currentTarget);
        var metadataList = target.parent().parent();
        if (this.noSave) {
            delete getMetadataRecord(this.item, this.fieldName)[this.key];
            metadataList.remove();
            return;
        }
        var params = {
            text: 'Are you sure you want to delete the metadatum <b>' +
                _.escape(this.key) + '</b>?',
            escapedHtml: true,
            yesText: 'Delete',
            confirmCallback: () => {
                this.item.removeMetadata(this.key, function () {
                    metadataList.remove();
                    // TODO: trigger an event?
                }, null, {
                    field: this.fieldName,
                    path: this.apiPath
                });
            }
        };
        confirm(params);
    },

    cancelEdit: function (event) {
        event.stopImmediatePropagation();
        const target = $(event.currentTarget);
        var curRow = target.parent().parent();
        if (this.newDatum) {
            curRow.remove();
        } else {
            this.parentView.render();
        }
    },

    save: function (event, value) {
        event.stopImmediatePropagation();
        const target = $(event.currentTarget);
        var curRow = target.parent(),
            tempKey = curRow.find('.g-widget-metadata-key-input').val().trim(),
            tempValue = (value !== undefined) ? value : curRow.find('.g-widget-metadata-value-input').val();

        if (this.newDatum && tempKey === '') {
            events.trigger('g:alert', {
                text: 'A key is required for all metadata.',
                type: 'warning'
            });
            return false;
        }

        var saveCallback = () => {
            this.key = tempKey;
            this.value = tempValue;

            this.parentView.key = this.key;
            this.parentView.value = this.value;

            if (this instanceof JsonMetadatumEditWidget) {
                this.parentView.mode = 'json';
            } else {
                this.parentView.mode = 'simple';
            }
            // TODO: trigger an event
            this.parentView.render();

            this.newDatum = false;
        };

        var errorCallback = function (out) {
            events.trigger('g:alert', {
                text: out.message,
                type: 'danger'
            });
        };

        if (this.newDatum) {
            if (this.onMetadataAdded) {
                this.onMetadataAdded(tempKey, tempValue, saveCallback, errorCallback);
            } else {
                if (this.noSave) {
                    if (getMetadataRecord(this.item, this.fieldName)[tempKey] !== undefined) {
                        events.trigger('g:alert', {
                            text: tempKey + ' is already a metadata key',
                            type: 'warning'
                        });
                        return false;
                    }
                    getMetadataRecord(this.item, this.fieldName)[tempKey] = tempValue;
                    // TODO: this.parentView.parentView.render();
                    return;
                }
                this.item.addMetadata(tempKey, tempValue, saveCallback, errorCallback, {
                    field: this.fieldName,
                    path: this.apiPath
                });
            }
        } else {
            if (this.onMetadataEdited) {
                this.onMetadataEdited(tempKey, this.key, tempValue, saveCallback, errorCallback);
            } else {
                if (this.noSave) {
                    tempKey = tempKey === '' ? this.key : tempKey;
                    if (tempKey !== this.key && getMetadataRecord(this.item, this.fieldName)[tempKey] !== undefined) {
                        events.trigger('g:alert', {
                            text: tempKey + ' is already a metadata key',
                            type: 'warning'
                        });
                        return false;
                    }
                    delete getMetadataRecord(this.item, this.fieldName)[this.key];
                    getMetadataRecord(this.item, this.fieldName)[tempKey] = tempValue;
                    // TODO: this.parentView.parentView.render();
                    return;
                }
                this.item.editMetadata(tempKey, this.key, tempValue, saveCallback, errorCallback, {
                    field: this.fieldName,
                    path: this.apiPath
                });
            }
        }
    },

    render: function () {
        this.$el.html(this.editTemplate({
            item: this.item,
            key: this.key,
            value: this.value,
            accessLevel: this.accessLevel,
            newDatum: this.newDatum,
            AccessType
        }));
        this.$el.find('.g-widget-metadata-key-input').trigger('focus');

        return this;
    }
});

var JsonMetadatumEditWidget = MetadatumEditWidget.extend({
    editTemplate: JsonMetadatumEditWidgetTemplate,

    getCurrentValue: function () {
        return this.editor.getText();
    },

    save: function (event) {
        try {
            MetadatumEditWidget.prototype.save.call(
                this, event, this.editor.get());
        } catch (err) {
            events.trigger('g:alert', {
                text: 'The field contains invalid JSON and can not be saved.',
                type: 'warning'
            });
            return false;
        }
    },

    render: function () {
        MetadatumEditWidget.prototype.render.apply(this, arguments);

        const jsonEditorEl = this.$el.find('.g-json-editor');
        this.editor = new JSONEditor(jsonEditorEl[0], {
            mode: 'tree',
            modes: ['code', 'tree'],
            onError: () => {
                events.trigger('g:alert', {
                    text: 'The field contains invalid JSON and can not be viewed in Tree Mode.',
                    type: 'warning'
                });
            }
        });

        if (this.value !== undefined) {
            this.editor.setText(JSON.stringify(this.value));
            this.editor.expandAll();
        }

        return this;
    }
});

wrap(MetadataWidget, 'initialize', function (initialize, settings) {
    const result = initialize.call(this, settings);
    this.noSave = settings.noSave;
    if (this.item.get('_modelType') === 'item') {
        largeImageConfig.getConfigFile(this.item.get('folderId')).done((val) => {
            this._limetadata = (val || {}).itemMetadata;
            if (this._limetadata) {
                this.render();
            }
        });
    } else {
        this._limetadata = null;
    }
    return result;
});

wrap(MetadataWidget, 'render', function (render) {
    var metaDict = this.item.get(this.fieldName) || {};
    var metaKeys = Object.keys(metaDict);
    metaKeys.sort(localeSort);

    // Metadata header
    this.$el.html((this.MetadataWidgetTemplate || MetadataWidgetTemplate)({
        item: this.item,
        title: this.title,
        accessLevel: this.accessLevel,
        AccessType: AccessType,
        limetadata: this._limetadata
    }));

    // Append each metadatum
    _.each(metaKeys, function (metaKey) {
        this.$el.find('.g-widget-metadata-container').append(new MetadatumWidget({
            mode: this.getModeFromValue(metaDict[metaKey]),
            key: metaKey,
            value: metaDict[metaKey],
            accessLevel: this.accessLevel,
            parentView: this,
            fieldName: this.fieldName,
            apiPath: this.apiPath,
            onMetadataEdited: this.onMetadataEdited,
            onMetadataAdded: this.onMetadataAdded
        }).render().$el);
    }, this);

    return this;
});

wrap(MetadataWidget, 'setItem', function (setItem, item) {
    setItem.call(this, item);
    this.item.on('g:changed', function () {
        this.render();
    }, this);
    this.render();
    return this;
});

MetadataWidget.prototype.modes.simple.editor = (args) => new MetadatumEditWidget(args);
MetadataWidget.prototype.modes.json.editor = (args) => {
    if (args.value !== undefined) {
        args.value = JSON.parse(args.value);
    }
    return new JsonMetadatumEditWidget(args);
};

MetadataWidget.prototype.events['click .li-add-metadata'] = function (evt) {
    this.addMetadataByKey(evt);
};

MetadataWidget.prototype.addMetadataByKey = function (evt) {
    const key = $(evt.target).attr('metadata-key');
    // if this key already exists, just go to editing it
    var EditWidget = this.modes.simple.editor;
    var value = ''; // default from config?

    var widget = new MetadatumWidget({
        className: 'g-widget-metadata-row editing',
        mode: 'simple',
        key: key,
        value: value,
        item: this.item,
        fieldName: this.fieldName,
        apiPath: this.apiPath,
        accessLevel: this.accessLevel,
        parentView: this,
        onMetadataEdited: this.onMetadataEdited,
        onMetadataAdded: this.onMetadataAdded
    });
    widget.$el.appendTo(this.$('.g-widget-metadata-container'));

    new EditWidget({
        item: this.item,
        key: key,
        value: value,
        fieldName: this.fieldName,
        apiPath: this.apiPath,
        accessLevel: this.accessLevel,
        newDatum: true,
        parentView: widget,
        onMetadataEdited: this.onMetadataEdited,
        onMetadataAdded: this.onMetadataAdded
    })
        .render()
        .$el.appendTo(widget.$el);
};

export default {
    MetadataWidget,
    MetadatumWidget,
    MetadatumEditWidget,
    JsonMetadatumEditWidget
};
