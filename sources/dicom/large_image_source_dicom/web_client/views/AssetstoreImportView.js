import $ from 'jquery';

import BrowserWidget from '@girder/core/views/widgets/BrowserWidget';
import router from '@girder/core/router';
import View from '@girder/core/views/View';
import { restRequest } from '@girder/core/rest';

import AssetstoreImportTemplate from '../templates/assetstoreImport.pug';

const AssetstoreImportView = View.extend({
    events: {
        'submit .g-dwas-import-form': function (e) {
            e.preventDefault();
            this.$('.g-validation-failed-message').empty();
            this.$('.g-submit-dwas-import').addClass('disabled');

            const parentType = this.$('#g-dwas-import-dest-type').val();
            const parentId = this.$('#g-dwas-import-dest-id').val().trim().split(/\s/)[0];

            this.model.off().on('g:imported', function () {
                router.navigate(parentType + '/' + parentId, { trigger: true });
            }, this).on('g:error', function (err) {
                this.$('.g-submit-dwas-import').removeClass('disabled');
                this.$('.g-validation-failed-message').html(err.responseText);
            }, this).dicomwebImport({
                parentId,
                parentType,
                progress: true
            });
        },
        'click .g-open-browser': '_openBrowser'
    },

    initialize: function () {
        this._browserWidgetView = new BrowserWidget({
            parentView: this,
            titleText: 'Destination',
            helpText: 'Browse to a location to select it as the destination.',
            submitText: 'Select Destination',
            validate: function (model) {
                const isValid = $.Deferred();
                if (!model) {
                    isValid.reject('Please select a valid root.');
                } else {
                    isValid.resolve();
                }
                return isValid.promise();
            }
        });

        this.listenTo(this._browserWidgetView, 'g:saved', function (val) {
            this.$('#g-dwas-import-dest-id').val(val.id);
            const model = this._browserWidgetView._hierarchyView.parentModel;
            const modelType = model.get('_modelType');
            this.$('#g-dwas-import-dest-type').val(modelType);

            // Make a rest request to get the resource path
            restRequest({
                url: `resource/${val.id}/path`,
                method: 'GET',
                data: { type: modelType }
            }).done((result) => {
                // Only add the resource path if the value wasn't altered
                if (this.$('#g-dwas-import-dest-id').val() === val.id) {
                    this.$('#g-dwas-import-dest-id').val(`${val.id} (${result})`);
                }
            });
        });
        this.render();
    },

    render: function () {
        this.$el.html(AssetstoreImportTemplate({
            assetstore: this.model
        }));

        return this;
    },

    _openBrowser: function () {
        this._browserWidgetView.setElement($('#g-dialog-container')).render();
    }
});

export default AssetstoreImportView;
