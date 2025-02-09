import sys

import pytest

from large_image.cache_util import cachesClear

from . import utilities

pytestmark = [
    pytest.mark.skipif(sys.version_info < (3, 8), reason='requires python3.8 or higher'),
]


@pytest.mark.plugin('large_image_source_dicom')
def testTilesFromDICOMweb():
    import large_image_source_dicom

    # Hopefully this URL and file will work for a long time. But we might need
    # to update it at some point.
    dicomweb_file = {
        'url': 'https://idc-external-006.uc.r.appspot.com/dcm4chee-arc/aets/DCM4CHEE/rs',
        'study_uid': '2.25.18199272949575141157802058345697568861',
        'series_uid': '1.3.6.1.4.1.5962.99.1.3510881361.982628633.1635598486609.2.0',
    }

    source = large_image_source_dicom.open(dicomweb_file)
    tileMetadata = source.getMetadata()

    assert tileMetadata['tileWidth'] == 256
    assert tileMetadata['tileHeight'] == 256
    assert tileMetadata['sizeX'] == 46336
    assert tileMetadata['sizeY'] == 44288
    assert tileMetadata['levels'] == 9

    utilities.checkTilesZXY(source, tileMetadata)

    source = None
    cachesClear()
